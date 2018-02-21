'use strict';

const _ = require('lodash');
const test = require('ava').test;
const Promise = require('bluebird');

const config = require('../../../config/default');
const tenderWriters = require('./../../../api/writers/tender');
const networkWriters = require('./../../../api/writers/network');
const clusterWriters = require('./../../../api/writers/actor_cluster');
const helpers = require('./../../helpers');
const fixtures = require('./../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

async function createNetwork() {
  const buyers = await fixtures.buildMany('rawBuyer', 3);
  await Promise.join(
    fixtures.build('rawBidWithBidder', { isWinning: true }),
    fixtures.build('rawBidWithBidder', { isWinning: false }),
    (loserBid, winningBid) => [loserBid, winningBid],
  )
    .then((bids) => fixtures.build('rawLot', { bids }))
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: _.take(buyers, 2),
      lots: [rawLot],
      country: 'CZ',
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender));
  await fixtures.build('rawFullTender', {
    buyers: _.takeRight(buyers, 2),
    country: 'CZ',
  })
    .then((rawTender) => tenderWriters.writeTender(rawTender));
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  return networkWriters.createNetwork(networkParams, undefined);
}

test.serial('createCluster raises for clusters with no nodes', async (t) => {
  t.plan(3);
  const network = await createNetwork();
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [],
  };
  const error = await t.throws(clusterWriters.createCluster(network.id, clusterParams));
  t.regex(error.message, /node/i);
  t.regex(error.message, /found/i);
});

test.serial('createCluster links cluster to network', async (t) => {
  const network = await createNetwork();
  const clusterBuyersQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type=:type
    LIMIT 2;`;
  const clusterBuyers = await config.db.query(
    clusterBuyersQuery,
    { params: { networkID: network.id, type: 'buyer' } },
  );
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: _.map(clusterBuyers, 'id'),
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  const networkLinks = await config.db.query(
    "SELECT out('PartOf') as links from ActorCluster WHERE id=:clusterID",
    { params: { clusterID: cluster.id } },
  );
  t.deepEqual(networkLinks[0].links, [network['@rid']]);
});

test.serial('createCluster links cluster to nodes', async (t) => {
  const network = await createNetwork();
  const clusterBuyersQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type=:type
    LIMIT 2;`;
  const clusterBuyers = await config.db.query(
    clusterBuyersQuery,
    { params: { networkID: network.id, type: 'buyer' } },
  );
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: _.map(clusterBuyers, 'id'),
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  const includesLinks = await config.db.query(
    "SELECT out('Includes') as links from ActorCluster WHERE id=:clusterID",
    { params: { clusterID: cluster.id } },
  );
  t.deepEqual(includesLinks[0].links, _.map(clusterBuyers, '@rid'));
});

test.serial('createCluster recalculates cluster values from component bids', async (t) => {
  const network = await createNetwork();
  const firstClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 2,
    })
    .one();
  const secondClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 1,
    })
    .one();
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [firstClusterBuyer.id, secondClusterBuyer.id],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  t.is(cluster.value, 2);
  t.is(cluster.medianCompetition, 1.5);
});

test.serial('createCluster recalculates contracts edges from component bids', async (t) => {
  const network = await createNetwork();
  const firstClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 2,
    })
    .one();
  const secondClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 1.5,
    })
    .one();
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [firstClusterBuyer.id, secondClusterBuyer.id],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  const contractsEdges = await config.db.select("expand(outE('Contracts'))")
    .from('ActorCluster')
    .where({ id: cluster.id })
    .all();
  t.is(contractsEdges.length, 2);
  t.is(contractsEdges[0].value, 1);
  t.is(contractsEdges[1].value, 1);
});

test.serial('createCluster recalculates partners edges ignoring edges between cluster components', async (t) => {
  const network = await createNetwork();
  const firstClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 2,
    })
    .one();
  const secondClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 1.5,
    })
    .one();
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [firstClusterBuyer.id, secondClusterBuyer.id],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  const partnersEdges = await config.db.select("expand(outE('Partners'))")
    .from('ActorCluster')
    .where({ id: cluster.id })
    .all();
  t.is(partnersEdges.length, 1);
  t.is(partnersEdges[0].value, 1);
});

test.serial('createCluster makes nodes involved in the cluster invalid', async (t) => {
  const network = await createNetwork();
  const clusterBuyersQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type=:type
    LIMIT 2;`;
  const clusterBuyers = await config.db.query(
    clusterBuyersQuery,
    { params: { networkID: network.id, type: 'buyer' } },
  );
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: _.map(clusterBuyers, 'id'),
  };
  await clusterWriters.createCluster(network.id, clusterParams);
  const updatedBuyers = await config.db.query(
    clusterBuyersQuery,
    { params: { networkID: network.id, type: 'buyer' } },
  );
  t.false(_.includes(_.map(updatedBuyers, 'active'), true));
});

test.serial('createCluster makes edges of nodes involved in the cluster invalid', async (t) => {
  const network = await createNetwork();
  const clusterBuyersQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type=:type
    LIMIT 2;`;
  const clusterBuyers = await config.db.query(
    clusterBuyersQuery,
    { params: { networkID: network.id, type: 'buyer' } },
  );
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: _.map(clusterBuyers, 'id'),
  };
  await clusterWriters.createCluster(network.id, clusterParams);
  const buyersEdges = await config.db.query(
    "SELECT expand(outE('NetworkEdge')) FROM NetworkActor where id in :nodes",
    { params: { nodes: _.map(clusterBuyers, 'id') } },
  );
  t.false(_.includes(_.map(buyersEdges, 'active'), true));
});

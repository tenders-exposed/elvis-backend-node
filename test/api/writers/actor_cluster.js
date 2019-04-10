'use strict';

const _ = require('lodash');
const test = require('ava');
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
    .then((rawTender) => tenderWriters.writeTender(rawTender, true));
  await fixtures.build('rawFullTender', {
    buyers: _.takeRight(buyers, 2),
    country: 'CZ',
  })
    .then((rawTender) => tenderWriters.writeTender(rawTender, true));
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
  const error = await t.throwsAsync(clusterWriters.createCluster(network.id, clusterParams));
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
  const partnersEdges = await config.db.select("expand(bothE('Partners'))")
    .from('ActorCluster')
    .where({ id: cluster.id })
    .all();
  t.is(partnersEdges.length, 1);
  t.is(partnersEdges[0].value, 1);
});

test.serial('createCluster makes nodes involved in the cluster inactive', async (t) => {
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
    'SELECT * FROM NetworkActor WHERE id in :nodes',
    { params: { nodes: clusterParams.nodes } },
  );
  t.false(_.includes(_.map(updatedBuyers, 'active'), true));
});

test.serial('createCluster makes edges of nodes involved in the cluster inactive', async (t) => {
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

test.serial('createCluster creates Contracts edge between two clusters', async (t) => {
  const network = await createNetwork();
  const clusterActorsQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type=:type
    LIMIT 2;`;
  const clusterBuyers = await config.db.query(
    clusterActorsQuery,
    { params: { networkID: network.id, type: 'buyer' } },
  );
  const clusterBidders = await config.db.query(
    clusterActorsQuery,
    { params: { networkID: network.id, type: 'bidder' } },
  );
  const buyerCluster = await clusterWriters.createCluster(
    network.id,
    {
      label: 'buyers crew',
      type: 'buyer',
      nodes: _.map(clusterBuyers, 'id'),
    },
  );
  const bidderCluster = await clusterWriters.createCluster(
    network.id,
    {
      label: 'bidders crew',
      type: 'bidder',
      nodes: _.map(clusterBidders, 'id'),
    },
  );
  const clustersEdge = await config.db.select()
    .from('NetworkEdge')
    .where({
      in: bidderCluster['@rid'],
      out: buyerCluster['@rid'],
    })
    .one();
  t.false(_.isUndefined(clustersEdge));
  t.is(clustersEdge.value, 2);
});

test.serial('createCluster creates Contracts edges between a cluster and nodes involved in another cluster', async (t) => {
  const network = await createNetwork();
  const clusterActorsQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type=:type
    LIMIT 2;`;
  const clusterBuyers = await config.db.query(
    clusterActorsQuery,
    { params: { networkID: network.id, type: 'buyer' } },
  );
  const clusterBidders = await config.db.query(
    clusterActorsQuery,
    { params: { networkID: network.id, type: 'bidder' } },
  );
  await clusterWriters.createCluster(
    network.id,
    {
      label: 'buyers crew',
      type: 'buyer',
      nodes: _.map(clusterBuyers, 'id'),
    },
  );
  const bidderCluster = await clusterWriters.createCluster(
    network.id,
    {
      label: 'bidders crew',
      type: 'bidder',
      nodes: _.map(clusterBidders, 'id'),
    },
  );
  const bidderClusterContracts = await config.db.query(
    "SELECT expand(inE('Contracts')) FROM NetworkActor where id=:bidderClusterID",
    { params: { bidderClusterID: bidderCluster.id } },
  );
  t.is(bidderClusterContracts.length, 4);
  t.is(_.filter(bidderClusterContracts, { active: false }).length, 2);
});

test.serial('createCluster creates Partners edge between two clusters', async (t) => {
  const network = await createNetwork();
  const firstClusterBuyers = await config.db.query(
    `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type='buyer'
    AND in('ActingAs').out('Awards').size() > 1;`,
    { params: { networkID: network.id } },
  );
  const secondClusterBuyers = await config.db.query(
    `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type='buyer'
    AND in('ActingAs').out('Awards').size() = 1;`,
    { params: { networkID: network.id } },
  );
  const firstCluster = await clusterWriters.createCluster(
    network.id,
    {
      label: 'first cluster',
      type: 'buyer',
      nodes: _.map(firstClusterBuyers, 'id'),
    },
  );
  const secondCluster = await clusterWriters.createCluster(
    network.id,
    {
      label: 'second cluster',
      type: 'buyer',
      nodes: _.map(secondClusterBuyers, 'id'),
    },
  );
  const clustersEdge = await config.db.select()
    .from('NetworkEdge')
    .where({
      in: secondCluster['@rid'],
      out: firstCluster['@rid'],
    })
    .one();
  t.false(_.isUndefined(clustersEdge));
  t.is(clustersEdge.value, 1);
});

test.serial('createCluster creates Partners edge between a cluster and nodes involved in another cluster', async (t) => {
  const network = await createNetwork();
  const firstClusterBuyers = await config.db.query(
    `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type='buyer'
    AND in('ActingAs').out('Awards').size() > 1;`,
    { params: { networkID: network.id } },
  );
  const secondClusterBuyers = await config.db.query(
    `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND type='buyer'
    AND in('ActingAs').out('Awards').size() = 1;`,
    { params: { networkID: network.id } },
  );
  const firstCluster = await clusterWriters.createCluster(
    network.id,
    {
      label: 'first cluster',
      type: 'buyer',
      nodes: _.map(firstClusterBuyers, 'id'),
    },
  );
  await clusterWriters.createCluster(
    network.id,
    {
      label: 'second cluster',
      type: 'buyer',
      nodes: _.map(secondClusterBuyers, 'id'),
    },
  );
  const clusterToActorEdge = await config.db.select()
    .from('NetworkEdge')
    .where({
      in: firstCluster['@rid'],
      out: secondClusterBuyers[0]['@rid'],
    })
    .one();
  t.is(clusterToActorEdge.active, false);
  t.is(clusterToActorEdge.value, 1);
});

test.serial('updateCluster links cluster to nodes added to the cluster', async (t) => {
  t.plan(2);
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
  const initialClusterNode = _.map(clusterBuyers, 'id')[0];
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [initialClusterNode],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  const linkedQuery = `SELECT out('Includes') as links
    FROM ActorCluster
    WHERE id in :clusterID`;
  const createdBuyers = await config.db.query(linkedQuery, { params: { clusterID: cluster.id } });
  t.is(createdBuyers[0].links.length, 1);

  const clusterUpdateParams = {
    nodes: _.map(clusterBuyers, 'id'),
  };
  await clusterWriters.updateCluster(network.id, cluster.id, clusterUpdateParams);
  const updatedBuyers = await config.db.query(linkedQuery, { params: { clusterID: cluster.id } });
  t.is(updatedBuyers[0].links.length, 2);
});

test.serial('updateCluster makes nodes added to the cluster inactive', async (t) => {
  t.plan(2);
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
  const initialClusterNode = _.map(clusterBuyers, 'id')[0];
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [initialClusterNode],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  const nodesQuery = 'SELECT * FROM NetworkActor WHERE id in :nodes';
  const createdBuyers = await config.db.query(
    nodesQuery,
    { params: { nodes: [initialClusterNode] } },
  );
  t.is(_.filter(createdBuyers, { active: false }).length, 1);

  const clusterUpdateParams = {
    nodes: _.map(clusterBuyers, 'id'),
  };
  await clusterWriters.updateCluster(network.id, cluster.id, clusterUpdateParams);
  const updatedBuyers = await config.db.query(
    nodesQuery,
    { params: { nodes: clusterUpdateParams.nodes } },
  );
  t.is(_.filter(updatedBuyers, { active: false }).length, 2);
});

test.serial('updateCluster makes edges of nodes added to the cluster inactive', async (t) => {
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
  const initialClusterNode = _.map(clusterBuyers, 'id')[0];
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [initialClusterNode],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);

  const clusterUpdateParams = {
    nodes: _.map(clusterBuyers, 'id'),
  };
  await clusterWriters.updateCluster(network.id, cluster.id, clusterUpdateParams);
  const updatedBuyerEdges = await config.db.query(
    "SELECT expand(outE('NetworkEdge')) FROM NetworkActor where id in :nodes",
    { params: { nodes: _.difference(clusterUpdateParams.nodes, clusterParams.nodes) } },
  );
  t.true(_.isEmpty(_.filter(updatedBuyerEdges, { active: true })));
});

test.serial('updateCluster removes link to nodes removed from the cluster', async (t) => {
  t.plan(2);
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
  const linkedQuery = `SELECT out('Includes') as links
    FROM ActorCluster
    WHERE id in :clusterID`;
  const createdBuyers = await config.db.query(linkedQuery, { params: { clusterID: cluster.id } });
  t.is(createdBuyers[0].links.length, 2);

  const clusterUpdateParams = {
    nodes: _.slice(clusterParams.nodes, 1),
  };
  await clusterWriters.updateCluster(network.id, cluster.id, clusterUpdateParams);
  const updatedBuyers = await config.db.query(linkedQuery, { params: { clusterID: cluster.id } });
  t.is(updatedBuyers[0].links.length, 1);
});

test.serial('updateCluster makes nodes removed from the cluster active', async (t) => {
  t.plan(2);
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
  const nodesQuery = 'SELECT * FROM NetworkActor WHERE id in :nodes';
  const createdBuyers = await config.db.query(
    nodesQuery,
    { params: { nodes: clusterParams.nodes } },
  );
  t.is(_.filter(createdBuyers, { active: false }).length, 2);

  const clusterUpdateParams = {
    nodes: _.slice(clusterParams.nodes, 1),
  };
  await clusterWriters.updateCluster(network.id, cluster.id, clusterUpdateParams);
  const updatedBuyers = await config.db.query(
    nodesQuery,
    { params: { nodes: _.difference(clusterParams.nodes, clusterUpdateParams.nodes) } },
  );
  t.is(_.filter(updatedBuyers, { active: true }).length, 1);
});

test.serial('updateCluster makes edges of nodes removed from the cluster active', async (t) => {
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

  const clusterUpdateParams = {
    nodes: _.slice(clusterParams.nodes, 1),
  };
  await clusterWriters.updateCluster(network.id, cluster.id, clusterUpdateParams);
  const updatedBuyerEdges = await config.db.query(
    "SELECT expand(outE('NetworkEdge')) FROM NetworkActor where id in :nodes",
    { params: { nodes: _.difference(clusterUpdateParams.nodes, clusterParams.nodes) } },
  );
  t.true(_.isEmpty(_.filter(updatedBuyerEdges, { active: true })));
});

test.serial('updateCluster recalculates cluster values with bids from added nodes', async (t) => {
  t.plan(4);
  const network = await createNetwork();
  const firstClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 2,
    })
    .one();
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [firstClusterBuyer.id],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  t.is(cluster.value, 1);
  t.is(cluster.medianCompetition, 2);

  const secondClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 1,
    })
    .one();
  const updatedCluster = await clusterWriters.updateCluster(
    network.id,
    cluster.id,
    { nodes: _.concat(clusterParams.nodes, [secondClusterBuyer.id]) },
  );
  t.is(updatedCluster.value, 2);
  t.is(updatedCluster.medianCompetition, 1.5);
});

test.serial('updateCluster recalculates cluster values witout bids from removed nodes', async (t) => {
  t.plan(4);
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
    nodes: _.map([firstClusterBuyer, secondClusterBuyer], 'id'),
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  t.is(cluster.value, 2);
  t.is(cluster.medianCompetition, 1.5);

  const updatedCluster = await clusterWriters.updateCluster(
    network.id,
    cluster.id,
    { nodes: [firstClusterBuyer.id] },
  );
  t.is(updatedCluster.value, 1);
  t.is(updatedCluster.medianCompetition, 2);
});

test.serial('updateCluster recalculates contracts edges with bids from added nodes', async (t) => {
  t.plan(4);
  const network = await createNetwork();
  const firstClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 2,
    })
    .one();
  const clusterParams = {
    label: 'actors crew',
    type: 'buyer',
    nodes: [firstClusterBuyer.id],
  };
  const cluster = await clusterWriters.createCluster(network.id, clusterParams);
  const contractsEdges = await config.db.select("expand(outE('Contracts'))")
    .from('ActorCluster')
    .where({ id: cluster.id })
    .all();
  t.is(contractsEdges.length, 1);
  t.is(contractsEdges[0].value, 1);

  const secondClusterBuyer = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
      medianCompetition: 1,
    })
    .one();
  await clusterWriters.updateCluster(
    network.id,
    cluster.id,
    { nodes: _.concat(clusterParams.nodes, [secondClusterBuyer.id]) },
  );
  const updatedContractsEdges = await config.db.select("expand(outE('Contracts'))")
    .from('ActorCluster')
    .where({ id: cluster.id })
    .all();
  t.is(updatedContractsEdges.length, 2);
  t.deepEqual(_.map(updatedContractsEdges, 'value'), [1, 1]);
});

test.serial('updateCluster recalculates contracts edges without bids from removed nodes', async (t) => {
  t.plan(2);
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
  const contractsEdges = await config.db.select("expand(outE('Contracts'))")
    .from('ActorCluster')
    .where({ id: cluster.id })
    .all();
  t.is(contractsEdges.length, 2);

  await clusterWriters.updateCluster(
    network.id,
    cluster.id,
    { nodes: [firstClusterBuyer.id] },
  );
  const updatedContractsEdges = await config.db.select("expand(outE('Contracts'))")
    .from('ActorCluster')
    .where({ id: cluster.id })
    .all();
  t.is(updatedContractsEdges.length, 1);
});

test.serial('deleteCluster makes nodes previously involved in the cluster active', async (t) => {
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
  const nodesQuery = 'SELECT * FROM NetworkActor WHERE id in :nodes';
  const createdBuyers = await config.db.query(
    nodesQuery,
    { params: { nodes: clusterParams.nodes } },
  );
  t.is(_.filter(createdBuyers, { active: false }).length, 2);

  await clusterWriters.deleteCluster(network.id, cluster.id);
  const updatedBuyers = await config.db.query(
    'SELECT * FROM NetworkActor WHERE id in :nodes',
    { params: { nodes: clusterParams.nodes } },
  );
  t.is(_.filter(updatedBuyers, { active: false }).length, 0);
});

test.serial('deleteCluster makes edges of nodes involved in the cluster active', async (t) => {
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
  await clusterWriters.deleteCluster(network.id, cluster.id);
  const updatedBuyerEdges = await config.db.query(
    "SELECT expand(outE('NetworkEdge')) FROM NetworkActor where id in :nodes",
    { params: { nodes: _.map(clusterBuyers, 'id') } },
  );
  t.is(_.filter(updatedBuyerEdges, { active: false }).length, 0);
});

test.serial('deleteCluster removes edges associated with the cluster', async (t) => {
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
  const includesQuery = `SELECT expand(inE('Includes')) 
    FROM NetworkActor
    WHERE id in :nodes
  `;
  const includesEdges = await config.db.query(
    includesQuery,
    { params: { nodes: clusterParams.nodes } },
  );
  t.is(includesEdges.length, 2);

  await clusterWriters.deleteCluster(network.id, cluster.id);
  const remainingIncludesEdges = await config.db.query(
    includesQuery,
    { params: { nodes: clusterParams.nodes } },
  );
  t.is(remainingIncludesEdges.length, 0);
});

test.serial('deleteCluster removes cluster', async (t) => {
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

  await clusterWriters.deleteCluster(network.id, cluster.id);
  const remainingCluster = await config.db.select()
    .from('ActorCluster')
    .where({ id: cluster.id })
    .one();
  t.is(remainingCluster, undefined);
});

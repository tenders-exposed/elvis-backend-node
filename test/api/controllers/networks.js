'use strict';

const _ = require('lodash');
const test = require('ava');
const Promise = require('bluebird');
const request = require('supertest');
const tenderWriters = require('../../../api/writers/tender');
const networkWriters = require('./../../../api/writers/network');
const networkSerializer = require('./../../../api/serializers/network');
const config = require('../../../config/default');
const codes = require('../../../api/helpers/codes');
const helpers = require('../../helpers');
const app = require('../../../server');
const fixtures = require('../../fixtures');

test.before('Create DB', () => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

async function formatNetworkResponse(network) {
  return {
    network: await networkSerializer.formatNetworkWithRelated(network),
  };
}

test.serial('createNetwork succeeds with empty nodes and edges', async (t) => {
  t.plan(2);
  const networkParams = {
    network: {
      query: {
        countries: [
          'CZ',
        ],
      },
      settings: {
        nodeSize: 'numberOfWinningBids',
        edgeSize: 'numberOfWinningBids',
      },
      name: 'createNetwork succeeds with empty nodes and edges',
    },
  };
  const res = await request(app)
    .post('/networks')
    .send(networkParams);
  t.is(res.status, codes.CREATED);
  const createdNetwork = await config.db.select()
    .from('Network')
    .where({ id: res.body.network.id })
    .one();
  t.deepEqual(res.body, await formatNetworkResponse(createdNetwork));
});

test.serial('createNetwork returns network with nodes and edges', async (t) => {
  t.plan(7);
  const buyer = await fixtures.build('rawBuyer');
  const bidders = await fixtures.buildMany('rawBidder', 2);
  await fixtures.build('rawBidWithBidder', { bidders })
    .then((rawBid) => fixtures.build('rawLot', { bids: [rawBid] }))
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [buyer],
      lots: [rawLot],
      country: 'CZ',
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender));
  const networkParams = {
    network: {
      query: {
        countries: [
          'CZ',
        ],
      },
      settings: {
        nodeSize: 'numberOfWinningBids',
        edgeSize: 'numberOfWinningBids',
      },
      name: 'createNetwork succeeds with empty nodes and edges',
    },
  };
  const res = await request(app)
    .post('/networks')
    .send(networkParams);
  t.is(res.status, codes.CREATED);
  const bidderNodesIDs = _.map(_.filter(res.body.network.nodes, { type: 'bidder' }), 'id');
  const buyerNodeIDs = _.map(_.filter(res.body.network.nodes, { type: 'buyer' }), 'id');
  t.is(bidderNodesIDs.length, 2);
  t.is(buyerNodeIDs.length, 1);
  t.deepEqual(
    _.uniq(_.map(_.filter(res.body.network.edges, { type: 'contracts' }), 'from')),
    buyerNodeIDs,
  );
  t.deepEqual(
    _.sortBy(_.uniq(_.map(_.filter(res.body.network.edges, { type: 'contracts' }), 'to'))),
    _.sortBy(bidderNodesIDs),
  );
  t.true(_.isEmpty(_.difference(
    _.map(_.filter(res.body.network.edges, { type: 'partners' }), 'from'),
    bidderNodesIDs,
  )));
  t.true(_.isEmpty(_.difference(
    _.map(_.filter(res.body.network.edges, { type: 'partners' }), 'to'),
    bidderNodesIDs,
  )));
});

test.serial('createNetwork links network to authenticated user', async (t) => {
  t.plan(3);
  const user = await helpers.createUser();
  const networkParams = {
    network: {
      query: {
        countries: [
          'CZ',
        ],
      },
      settings: {
        nodeSize: 'numberOfWinningBids',
        edgeSize: 'numberOfWinningBids',
      },
    },
  };
  const res = await request(app)
    .post('/networks')
    .set('Authorization', user.accessTokens[0])
    .send(networkParams);
  t.is(res.status, codes.CREATED);

  const createdNetwork = await config.db.select()
    .from('Network')
    .where({
      id: res.body.network.id,
      "in('Owns').id": user.id,
    })
    .one();
  t.not(createdNetwork, undefined);
  t.deepEqual(res.body, await formatNetworkResponse(createdNetwork));
});

test.serial('createNetwork doesn\'t create network if the authorizaton fails', async (t) => {
  t.plan(2);
  const networkParams = {
    network: {
      query: {
        countries: [
          'CZ',
        ],
      },
      settings: {
        nodeSize: 'numberOfWinningBids',
        edgeSize: 'numberOfWinningBids',
      },
      name: "createNetwork doesn't create network if the authorizaton fails",
    },
  };
  const res = await request(app)
    .post('/networks')
    .set('Authorization', 'lololo')
    .send(networkParams);
  t.is(res.status, codes.BAD_REQUEST);

  const createdNetwork = await config.db.select()
    .from('Network')
    .where({
      name: networkParams.network.name,
    })
    .one();
  t.is(createdNetwork, undefined);
});

test.serial('getNetwork returns network with related', async (t) => {
  t.plan(2);
  const networkParams = {
    query: {
      countries: [
        'CZ',
      ],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const res = await request(app)
    .get(`/networks/${network.id}`);
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(res.body, await formatNetworkResponse(network));
});

test.serial('getNetwork returns error if the network is not found', async (t) => {
  t.plan(1);
  const res = await request(app)
    .get('/networks/patronum');
  t.is(res.status, codes.NOT_FOUND);
});

test.serial('getNetworks returns a user\'s networks', async (t) => {
  t.plan(2);
  const user = await helpers.createUser();
  const networkParams = {
    query: {
      countries: [
        'CZ',
      ],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const userNetworks = await Promise.map([1, 2], () =>
    networkWriters.createNetwork(networkParams, user));
  await networkWriters.createNetwork(networkParams, undefined);
  const res = await request(app)
    .get('/networks')
    .set('Authorization', user.accessTokens[0]);
  t.is(res.status, codes.SUCCESS);

  const networks = await Promise.map(userNetworks, (network) =>
    networkSerializer.formatNetwork(network));
  t.deepEqual(
    _.sortBy(res.body.networks, 'id'),
    _.sortBy(networks, 'id'),
  );
});

test.serial('getNetworks fails if authorization is not provided', async (t) => {
  t.plan(3);
  const res = await request(app)
    .get('/networks');
  t.is(res.status, codes.BAD_REQUEST);
  t.regex(res.body.errors[0].message, /require/i);
  t.regex(res.body.errors[0].message, /authorization/i);
});

test.serial('deleteNetwork deletes a user\'s network', async (t) => {
  t.plan(2);
  const user = await helpers.createUser();
  const networkParams = {
    query: {
      countries: [
        'CZ',
      ],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const userNetwork = await networkWriters.createNetwork(networkParams, user);
  const res = await request(app)
    .delete(`/networks/${userNetwork.id}`)
    .set('Authorization', user.accessTokens[0]);
  t.is(res.status, codes.NO_CONTENT);

  const deletedNetwork = await config.db.select()
    .from('Network')
    .where({ id: userNetwork.id })
    .one();
  t.is(deletedNetwork, undefined);
});

test.serial('deleteNetwork fails if authorization is not provided', async (t) => {
  t.plan(3);
  const user = await helpers.createUser();
  const networkParams = {
    query: {
      countries: [
        'CZ',
      ],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const userNetwork = await networkWriters.createNetwork(networkParams, user);
  const res = await request(app)
    .delete(`/networks/${userNetwork.id}`);
  t.is(res.status, codes.BAD_REQUEST);
  t.regex(res.body.errors[0].message, /require/i);
  t.regex(res.body.errors[0].message, /authorization/i);
});

test.serial('deleteNetwork fails if user doesn\'t own the network', async (t) => {
  t.plan(1);
  const networkOwner = await helpers.createUser();
  const randomUser = await helpers.createUser();
  const networkParams = {
    query: {
      countries: [
        'CZ',
      ],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, networkOwner);
  const res = await request(app)
    .delete(`/networks/${network.id}`)
    .set('Authorization', randomUser.accessTokens[0]);
  t.is(res.status, codes.UNAUTHORIZED);
});

test.serial('deleteNetwork returns error if the network is not found', async (t) => {
  t.plan(1);
  const user = await helpers.createUser();
  const res = await request(app)
    .delete('/networks/focuspocus')
    .set('Authorization', user.accessTokens[0]);
  t.is(res.status, codes.NOT_FOUND);
});

test.serial('updateNetwork returns error if the network is not found', async (t) => {
  t.plan(1);
  const user = await helpers.createUser();
  const res = await request(app)
    .patch('/networks/focuspocus')
    .set('Authorization', user.accessTokens[0]);
  t.is(res.status, codes.NOT_FOUND);
});

test.serial('updateNetwork doesn\'t update network if the authorizaton fails', async (t) => {
  t.plan(2);
  const networkParams = {
    query: {
      countries: [
        'CZ',
      ],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const updateParams = {
    network: {
      name: "updateNetwork doesn't update network if the authorizaton fails",
    },
  };
  const res = await request(app)
    .patch(`/networks/${network.id}`)
    .set('Authorization', 'lololo')
    .send(updateParams);
  t.is(res.status, codes.BAD_REQUEST);

  const updatedNetwork = await config.db.select()
    .from('Network')
    .where({ id: network.id })
    .one();
  t.is(updatedNetwork.name, undefined);
});

test.serial('updateNetwork updates network if the authorizaton succeeds', async (t) => {
  t.plan(2);
  const user = await helpers.createUser();
  const networkParams = {
    query: {
      countries: [
        'CZ',
      ],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, user);
  const updateParams = {
    network: {
      name: "updateNetwork doesn't update network if the authorizaton fails",
    },
  };
  const res = await request(app)
    .patch(`/networks/${network.id}`)
    .set('Authorization', user.accessTokens[0])
    .send(updateParams);
  t.is(res.status, codes.SUCCESS);

  const updatedNetwork = await config.db.select()
    .from('Network')
    .where({ id: network.id })
    .one();
  t.is(updatedNetwork.name, updateParams.network.name);
});

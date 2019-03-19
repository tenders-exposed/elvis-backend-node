'use strict';

const _ = require('lodash');
const test = require('ava');
const Promise = require('bluebird');
const OrientDBError = require('orientjs/lib/errors');

const config = require('../../../config/default');
const tenderWriters = require('./../../../api/writers/tender');
const networkWriters = require('./../../../api/writers/network');
const helpers = require('./../../helpers');
const fixtures = require('./../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

function selectNetworkActors(networkID, actorIDS) {
  const networkActorsQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND in('ActingAs').id in :actorIDS`;
  return config.db.query(networkActorsQuery, {
    params: { networkID, actorIDS },
  });
}

function selectNetworkEdges(networkID, actorIDS) {
  const edgesQuery = `SELECT *
    FROM NetworkEdge
    WHERE out.out('PartOf').id=:networkID
    AND out.in('ActingAs').id in :actorIDS`;
  return config.db.query(edgesQuery, {
    params: { networkID, actorIDS },
  });
}

test.serial('createNetwork creates network without nodes', async (t) => {
  t.plan(3);
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
    name: 'createNetwork creates network without nodes',
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  t.not(network['@rid'], undefined);
  t.is(network.name, networkParams.name);
  t.is(networkParams.query, networkParams.query);
});

test.serial('createNetwork filters bids by query', async (t) => {
  const queryBuyer = await fixtures.build('rawBuyer');
  const queryBidder = await fixtures.build('rawBidder');
  const bidders = await fixtures.buildMany('rawBidder', 2);
  const buyer = await fixtures.build('rawBuyer');
  const queryCpv = await fixtures.build('rawCpv');
  const queryYear = 2017;
  const queryCountry = 'CZ';
  await fixtures.build('rawBidWithBidder', { bidders })
    .then((bid) => fixtures.build('rawLot', {
      bids: [bid],
      awardDecisionDate: `${queryYear}-01-17`,
    }))
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [queryBuyer],
      lots: [rawLot],
      cpvs: [queryCpv],
      country: queryCountry,
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender));
  await fixtures.build('rawBidWithBidder', { bidders: [queryBidder] })
    .then((bid) => fixtures.build('rawLot', {
      bids: [bid],
      awardDecisionDate: `${queryYear}-11-12`,
    }))
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [buyer],
      lots: [rawLot],
      cpvs: [queryCpv],
      country: queryCountry,
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender));
  await fixtures.build('rawFullTender', {
    country: 'NL',
  })
    .then((rawTender) => tenderWriters.writeTender(rawTender));
  const networkParams = {
    query: {
      countries: [queryCountry],
      cpvs: [queryCpv.code],
      years: [queryYear],
      buyers: [queryBuyer.id],
      bidders: [queryBidder.id],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const networkActors = await config.db.query(
    "SELECT *, in('ActingAs').id as actorID FROM NetworkActor WHERE out('PartOf').id=:networkID",
    { params: { networkID: network.id } },
  );
  const expectedActors = _.concat(
    _.map(bidders, 'id'),
    [buyer.id, queryBidder.id, queryBuyer.id],
  );
  const involvedActors = _.map(networkActors, (node) => node.actorID[0]);
  t.deepEqual(_.sortBy(involvedActors), _.sortBy(expectedActors));
});

test.serial('createNetwork raises error if query is empty', async (t) => {
  t.plan(3);
  const networkParams = {
    query: {},
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };

  const error = await t.throwsAsync(networkWriters.createNetwork(networkParams, undefined));
  t.regex(error.message, /query/i);
  t.regex(error.message, /empty/i);
});

test.serial('createNetwork raises error if mandatory settings are missing', async (t) => {
  t.plan(3);
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
    },
  };
  const error = await t.throwsAsync(
    networkWriters.createNetwork(networkParams, undefined),
    { instanceOf: OrientDBError.RequestError },
  );
  t.regex(error.message, /edgeSize/i);
  t.regex(error.message, /mandatory/i);
});

test.serial('createNetwork creates network actors ', async (t) => {
  t.plan(2);
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
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const networkBuyers = await selectNetworkActors(network.id, [buyer.id]);
  const networkBidders = await selectNetworkActors(network.id, _.map(bidders, 'id'));
  t.is(networkBuyers.length, 1);
  t.is(networkBidders.length, 2);
});

test.serial('createNetwork creates actor even if the counterpart misses', async (t) => {
  t.plan(1);
  const buyer = await fixtures.build('rawBuyer');
  await fixtures.build('rawFullTender', {
    buyers: [buyer],
    country: 'CZ',
  }).then((rawTender) => tenderWriters.writeTender(rawTender));
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const networkBuyers = await selectNetworkActors(network.id, [buyer.id]);
  t.is(networkBuyers.length, 1);
});

test.serial('createNetwork creates network edges ', async (t) => {
  t.plan(2);
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
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);

  const contractsEdges = await selectNetworkEdges(network.id, [buyer.id]);
  const partnersEdges = await selectNetworkEdges(network.id, _.map(bidders, 'id'));
  t.is(contractsEdges.length, 2);
  t.is(partnersEdges.length, 1);
});

test.serial('createNetwork uses number of winning bids for node size', async (t) => {
  t.plan(3);
  const buyer = await fixtures.build('rawBuyer');
  const bidders = await fixtures.buildMany('rawBidder', 2);
  const bids = await Promise.map(bidders, (bidder) =>
    fixtures.build('rawBidWithBidder', { bidders: [bidder] }));
  await fixtures.build('rawLot', { bids })
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [buyer],
      lots: [rawLot],
      country: 'CZ',
    }))
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
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const networkBuyers = await selectNetworkActors(network.id, [buyer.id]);
  const networkBidders = await selectNetworkActors(network.id, _.map(bidders, 'id'));
  t.is(networkBuyers[0].value, 2);
  t.is(networkBidders[0].value, 1);
  t.is(networkBidders[1].value, 1);
});

test.serial('createNetwork uses amount of money exchanged for node size', async (t) => {
  t.plan(3);
  const buyer = await fixtures.build('rawBuyer');
  const bidders = await fixtures.buildMany('rawBidder', 2);
  const bids = await Promise.map(bidders, (bidder) =>
    fixtures.build('rawBidWithBidder', {
      bidders: [bidder],
      price: {
        netAmountEur: 201921.4,
      },
    }));
  await fixtures.build('rawLot', { bids })
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [buyer],
      lots: [rawLot],
      country: 'CZ',
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender));
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const networkBuyers = await selectNetworkActors(network.id, [buyer.id]);
  const networkBidders = await selectNetworkActors(network.id, _.map(bidders, 'id'));
  t.is(networkBuyers[0].value, 403842.8);
  t.is(networkBidders[0].value, 201921.4);
  t.is(networkBidders[1].value, 201921.4);
});

test.serial('createNetwork uses number of winning bids for contracts edge size ', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer');
  const bidder = await fixtures.build('rawBidder');
  await Promise.each([1, 2, 3], () => fixtures.build('rawBid', { bidders: [bidder] })
    .then((rawBid) => fixtures.build('rawLot', { bids: [rawBid] }))
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [buyer],
      lots: [rawLot],
      country: 'CZ',
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender)));
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'numberOfWinningBids',
      edgeSize: 'numberOfWinningBids',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const contractsEdges = await selectNetworkEdges(network.id, [buyer.id, bidder.id]);
  t.is(contractsEdges.length, 1);
  t.is(contractsEdges[0].value, 3);
});

test.serial('createNetwork uses amount of money exchanged bids for contracts edge size ', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer');
  const bidder = await fixtures.build('rawBidder');
  await Promise.each([1, 2, 3], () => fixtures.build('rawBid', {
    bidders: [bidder],
    price: {
      netAmountEur: 201.4,
    },
  })
    .then((rawBid) => fixtures.build('rawLot', { bids: [rawBid] }))
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [buyer],
      lots: [rawLot],
      country: 'CZ',
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender)));
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const contractsEdges = await selectNetworkEdges(network.id, [buyer.id, bidder.id]);
  t.is(contractsEdges.length, 1);
  t.is(contractsEdges[0].value, (201.4 * 3));
});

test.serial('createNetwork uses number of shared bids for partners edge size ', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer');
  const bidders = await fixtures.buildMany('rawBidder', 2);
  await Promise.each([1, 2, 3], () => fixtures.build('rawBid', { bidders })
    .then((rawBid) => fixtures.build('rawLot', { bids: [rawBid] }))
    .then((rawLot) => fixtures.build('rawTender', {
      buyers: [buyer],
      lots: [rawLot],
      country: 'CZ',
    }))
    .then((rawTender) => tenderWriters.writeTender(rawTender)));
  const networkParams = {
    query: {
      countries: ['CZ'],
    },
    settings: {
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const partnersEdges = await selectNetworkEdges(network.id, _.map(bidders, 'id'));
  t.is(partnersEdges.length, 1);
  t.is(partnersEdges[0].value, 3);
});

test.serial('createNetwork calculates medianCompetition for nodes', async (t) => {
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
      nodeSize: 'amountOfMoneyExchanged',
      edgeSize: 'amountOfMoneyExchanged',
    },
  };
  const network = await networkWriters.createNetwork(networkParams, undefined);
  const networkBuyers = await config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      type: 'buyer',
    })
    .all();
  t.deepEqual(_.sortBy(_.map(networkBuyers, 'medianCompetition')), [1, 1.5, 2]);
});

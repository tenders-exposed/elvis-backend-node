'use strict';

const request = require('supertest');
const test = require('ava');

const _ = require('lodash');
const writers = require('../../../api/writers/tender');
const codes = require('../../../api/helpers/codes');
const actorSerializer = require('../../../api/serializers/actor');
const helpers = require('../../helpers');
const app = require('../../../server');
const fixtures = require('../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

function expectedResponse(actors) {
  return {
    actors: actors.map((actor) => _.omitBy(actorSerializer.formatActor(actor), _.isUndefined)),
  };
}

test.serial('getTenderActors returns empty array if there are no matching actors', async (t) => {
  t.plan(2);
  const res = await request(app)
    .get('/tenders/actors?name=lololo');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual({ actors: [] }, res.body);
});

test.serial('getTenderActors returns all actors by default', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer', { '@class': 'Buyer' });
  const bidder = await fixtures.build('rawBidder', { '@class': 'Bidder' });
  await fixtures.build('rawBidWithBidder', { bidders: [bidder] })
    .then((bid) => fixtures.build('rawLotWithBid', { bids: [bid] }))
    .then((lot) => fixtures.build('rawFullTender', {
      buyers: [buyer],
      lots: [lot],
    }))
    .then((rawTender) => writers.writeTender(rawTender));
  const res = await request(app)
    .get('/tenders/actors');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse([buyer, bidder]), res.body);
});

test.serial('getTenderActors limits actors to limit', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer', { '@class': 'Buyer' });
  const secondBuyer = await fixtures.build('rawBuyer', { '@class': 'Buyer' });
  await fixtures.build('rawFullTender', {
    buyers: [buyer, secondBuyer],
  })
    .then((rawTender) => writers.writeTender(rawTender));
  const res = await request(app)
    .get('/tenders/actors?limit=1');

  t.is(res.status, codes.SUCCESS);
  t.is(res.body.actors.length, 1);
});

test.serial('getTenderActors filters actors by cpvs', async (t) => {
  t.plan(2);
  const cpv = await fixtures.build('rawCpv');
  const expectedBuyer = await fixtures.build('rawBuyer', { '@class': 'Buyer' });
  const expectedBidder = await fixtures.build('rawBidder', { '@class': 'Bidder' });
  await fixtures.build('rawBidWithBidder', { bidders: [expectedBidder] })
    .then((bid) => fixtures.build('rawLotWithBid', { bids: [bid] }))
    .then((lot) => fixtures.build('rawFullTender', {
      buyers: [expectedBuyer],
      lots: [lot],
      cpvs: [cpv],
    }))
    .then((rawTender) => writers.writeTender(rawTender));
  await fixtures.build('rawFullTender', {
    cpvs: fixtures.buildMany('rawCpv', 1),
    buyers: fixtures.buildMany('rawBuyer', 1, { '@class': 'Buyer' }),
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/actors?cpvs=${cpv.code}`);

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse([expectedBuyer, expectedBidder]), res.body);
});

test.serial('getTenderActors filters actors by year', async (t) => {
  t.plan(2);
  const expectedYear = 2016;
  const alternativeYear = 2017;
  const expectedBuyer = await fixtures.build('rawBuyer', { '@class': 'Buyer' });
  const expectedBidder = await fixtures.build('rawBidder', { '@class': 'Bidder' });
  await fixtures.build('rawBidWithBidder', { bidders: [expectedBidder] })
    .then((bid) => fixtures.build('rawLotWithBid', {
      bids: [bid],
      awardDecisionDate: `${expectedYear}-01-02`,
    }))
    .then((lot) => fixtures.build('rawFullTender', {
      buyers: [expectedBuyer],
      lots: [lot],
    }))
    .then((rawTender) => writers.writeTender(rawTender));
  await fixtures.build('rawLot', {
    awardDecisionDate: `${alternativeYear}-01-10`,
  })
    .then((lot) => fixtures.build('rawFullTender', {
      lots: [lot],
      buyers: fixtures.buildMany('rawBuyer', 1, { '@class': 'Buyer' }),
    }))
    .then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/actors?years=${expectedYear},2017`);

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse([expectedBuyer, expectedBidder]), res.body);
});

test.serial('getTenderActors filters actors by countries', async (t) => {
  t.plan(2);
  const expectedCountry = 'CZ';
  const alternativeContry = 'NL';
  const expectedBuyer = await fixtures.build('rawBuyer', { '@class': 'Buyer' });
  const expectedBidder = await fixtures.build('rawBidder', { '@class': 'Bidder' });
  await fixtures.build('rawBidWithBidder', { bidders: [expectedBidder] })
    .then((bid) => fixtures.build('rawLotWithBid', { bids: [bid] }))
    .then((lot) => fixtures.build('rawFullTender', {
      buyers: [expectedBuyer],
      lots: [lot],
      country: expectedCountry,
    }))
    .then((rawTender) => writers.writeTender(rawTender));
  await fixtures.build('rawFullTender', {
    country: alternativeContry,
    buyers: fixtures.buildMany('rawBuyer', 1, { '@class': 'Buyer' }),
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/actors?countries[]=${expectedCountry}`);

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse([expectedBuyer, expectedBidder]), res.body);
});

test.serial('getTenderActors provides sugestions based on name', async (t) => {
  t.plan(2);
  const expectedBuyer = await fixtures.build('rawBuyer', {
    name: 'Ministry of Magic',
    '@class': 'Buyer',
  });
  const alternativeBuyer = await fixtures.build('rawBuyer', {
    name: 'Azkaban',
    '@class': 'Buyer',
  });
  await fixtures.build('rawFullTender', {
    buyers: [expectedBuyer, alternativeBuyer],
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get('/tenders/actors?name=minis');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse([expectedBuyer]), res.body);
});

test.serial('getTenderActors allows lucene queries', async (t) => {
  t.plan(2);
  const expectedBuyer = await fixtures.build('rawBuyer', {
    name: 'Ministry of Magic',
    '@class': 'Buyer',
  });
  const alternativeBuyer = await fixtures.build('rawBuyer', {
    name: 'Ministry of Teleportation',
    '@class': 'Buyer',
  });
  await fixtures.build('rawFullTender', {
    buyers: [expectedBuyer, alternativeBuyer],
  }).then((ten) => writers.writeTender(ten));

  const res = await request(app)
    .get('/tenders/actors?name=ministry AND magic');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse([expectedBuyer]), res.body);
});

test.serial('getTenderActors ackowledges whitespace in query string', async (t) => {
  t.plan(2);
  const expectedBuyer = await fixtures.build('rawBuyer', {
    name: 'Expelli armus',
    '@class': 'Buyer',
  });
  const alternativeBuyer = await fixtures.build('rawBuyer', {
    name: 'Expelliarmus',
    '@class': 'Buyer',
  });
  await fixtures.build('rawFullTender', {
    buyers: [expectedBuyer, alternativeBuyer],
  }).then((ten) => writers.writeTender(ten));

  const res = await request(app)
    .get('/tenders/actors?name=expelli%20%20');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse([expectedBuyer]), res.body);
});

// TODO: Uncomment this after switching to ODB3 SEARCH_CLASS function
// test.serial('getTenderActors orders suggestions by score', async (t) => {
//   t.plan(2);
//   const expectedBuyer = await fixtures.build('rawBuyer', {
//     name: 'Azkaban',
//     '@class': 'Buyer',
//   });
//   const expectedBidder = await fixtures.build('rawBidder', {
//     name: 'Azkabran',
//     '@class': 'Bidder',
//   });
//   await fixtures.build('rawBidWithBidder', { bidders: [expectedBidder] })
//     .then((bid) => fixtures.build('rawLotWithBid', { bids: [bid] }))
//     .then((lot) => fixtures.build('rawFullTender', {
//       buyers: [expectedBuyer],
//       lots: [lot],
//     }))
//     .then((rawTender) => writers.writeTender(rawTender));
//   const res = await request(app)
//     .get('/tenders/actors?name=azkaban~');

//   t.is(res.status, codes.SUCCESS);
//   t.deepEqual(await expectedResponse([expectedBuyer, expectedBidder]), res.body);
// });

'use strict';

const _ = require('lodash');
const request = require('supertest');
const test = require('ava');
const Promise = require('bluebird');
const writers = require('../../../api/writers/tender');
const codes = require('../../../api/helpers/codes');
const config = require('../../../config/default');
const cpvSerializer = require('../../../api/serializers/cpv');
const helpers = require('../../helpers');
const app = require('../../../server');
const fixtures = require('../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

function expectedResponse(matchTenderID) {
  return config.db.select('expand(out("HasCPV"))')
    .from('Tender')
    .where({ id: matchTenderID })
    .all()
    .then((writtenCpvs) => ({
      cpvs: _.map(_.sortBy(writtenCpvs, 'code'), (cpv) => {
        cpv.xNumberBids = 1;
        cpv.military = true;
        return cpvSerializer.formatCpv(cpv);
      }),
    }));
}

test.serial('getTenderCpvs returns empty array if there are no cpvs', async (t) => {
  t.plan(2);
  const res = await request(app)
    .get('/tenders/cpvs');
  t.is(res.status, codes.SUCCESS);
  t.deepEqual({ cpvs: [] }, res.body);
});

test.serial('getTenderCpvs returns all cpvs by default', async (t) => {
  t.plan(2);
  const cpvs = fixtures.assocAttrsMany('rawCpv', 2);
  const tender = await fixtures.build('rawFullTender', { cpvs })
    .then((rawTender) => writers.writeTender(rawTender));
  const res = await request(app)
    .get('/tenders/cpvs');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse(tender.id), res.body);
});

test.serial('getTenderCpvs filters cpvs by country', async (t) => {
  t.plan(2);
  const rawMatchTender = await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    country: 'RO',
  }).then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    country: 'NL',
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get('/tenders/cpvs?countries[]=RO');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse(rawMatchTender.id), res.body);
});

test.serial('getTenderCpvs filters cpvs by buyer', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer');
  const rawMatchTender = await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    buyers: [buyer],
  }).then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/cpvs?buyers[]=${buyer.id}`);

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse(rawMatchTender.id), res.body);
});

test.serial('getTenderCpvs filters cpvs by bidder', async (t) => {
  t.plan(2);
  const bidder = await fixtures.build('rawBidder');
  const rawMatchTender = await fixtures.build('rawBid', { bidders: [bidder] })
    .then((bid) => fixtures.build('rawLot', { bids: [bid] }))
    .then((lot) => fixtures.build('rawFullTender', {
      cpvs: fixtures.assocAttrsMany('rawCpv', 2),
      lots: [lot],
    }))
    .then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/cpvs?bidders[]=${bidder.id}`);

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse(rawMatchTender.id), res.body);
});

test.serial('getTenderCpvs filters cpvs by bidder or buyer', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer');
  const bidder = await fixtures.build('rawBidder');
  const bidderCpv = await fixtures.build('rawCpv');
  const buyerCpv = await fixtures.build('rawCpv');
  await fixtures.build('rawBid', { bidders: [bidder] })
    .then((bid) => fixtures.build('rawLot', { bids: [bid] }))
    .then((lot) => fixtures.build('rawFullTender', {
      cpvs: [bidderCpv],
      lots: [lot],
    }))
    .then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    cpvs: [buyerCpv],
    buyers: [buyer],
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/cpvs?bidders[]=${bidder.id}&buyers[]=${buyer.id}`);
  t.is(res.status, codes.SUCCESS);
  const expectedCpvs = await Promise.join(
    config.db.select().from('CPV').where({ code: bidderCpv.code }).one(),
    config.db.select().from('CPV').where({ code: buyerCpv.code }).one(),
    (fullBidderCpv, fullBuyerCpv) => {
      const cpvs = _.sortBy([fullBidderCpv, fullBuyerCpv], 'code');
      const formattedCpvs = _.map(cpvs, (cpv) => {
        cpv.xNumberBids = 1;
        return cpvSerializer.formatCpv(cpv);
      });
      return {
        cpvs: formattedCpvs,
      };
    },
  );
  t.deepEqual(expectedCpvs, res.body);
});

test.serial('getTenderCpvs filters cpvs by year', async (t) => {
  t.plan(2);
  const rawMatchTender = await fixtures.build('rawLotWithBid', {
    awardDecisionDate: '2016-01-02',
  })
    .then((lot) => fixtures.build('rawFullTender', {
      cpvs: fixtures.assocAttrsMany('rawCpv', 2),
      lots: [lot],
    }))
    .then((ten) => writers.writeTender(ten));
  await fixtures.build('rawLot', {
    awardDecisionDate: '2017-01-10',
  })
    .then((lot) => fixtures.build('rawFullTender', {
      cpvs: fixtures.assocAttrsMany('rawCpv', 2),
      lots: [lot],
    }))
    .then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get('/tenders/cpvs?years=2016,2017');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse(rawMatchTender.id), res.body);
});

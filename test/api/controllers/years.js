'use strict';

const request = require('supertest');
const test = require('ava');
const writers = require('../../../api/writers/tender');
const codes = require('../../../api/helpers/codes');
const helpers = require('../../helpers');
const app = require('../../../server');
const fixtures = require('../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

test.serial('getTenderYears returns empty array if there are no bids', async (t) => {
  t.plan(2);
  const res = await request(app)
    .get('/tenders/years');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual({ years: [] }, res.body);
});

test.serial('getTenderYears returns all years by default', async (t) => {
  t.plan(2);
  const expectedYear = 2016;
  const lot = await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${expectedYear}-01-17`,
  });
  await fixtures.build('rawFullTender', { lots: [lot] })
    .then((rawTender) => writers.writeTender(rawTender, true));
  const res = await request(app)
    .get('/tenders/years');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual({ years: [expectedYear] }, res.body);
});

test.serial('getTenderYears filters years by cpvs', async (t) => {
  t.plan(2);
  const expectedYear = 2018;
  const alternativeYear = 2016;
  const cpv = await fixtures.build('rawCpv');
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${expectedYear}-01-17`,
  }).then((lot) => fixtures.build('rawFullTender', {
    cpvs: [cpv],
    lots: [lot],
  })).then((ten) => writers.writeTender(ten, true));
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${alternativeYear}-01-17`,
  }).then((lot) => fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    lots: [lot],
  })).then((ten) => writers.writeTender(ten, true));
  const res = await request(app)
    .get(`/tenders/years?cpvs=${cpv.code}`);

  t.is(res.status, codes.SUCCESS);
  t.deepEqual({ years: [expectedYear] }, res.body);
});

test.serial('getTenderYears filters years by buyer', async (t) => {
  t.plan(2);
  const expectedYear = 2018;
  const alternativeYear = 2016;
  const buyer = await fixtures.build('rawBuyer');
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${expectedYear}-01-17`,
  }).then((lot) => fixtures.build('rawFullTender', {
    buyers: [buyer],
    lots: [lot],
  })).then((ten) => writers.writeTender(ten, true));
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${alternativeYear}-01-17`,
  }).then((lot) => fixtures.build('rawFullTender', {
    lots: [lot],
  })).then((ten) => writers.writeTender(ten, true));
  const res = await request(app)
    .get(`/tenders/years?buyers[]=${buyer.id}`);

  t.is(res.status, codes.SUCCESS);
  await t.deepEqual({ years: [expectedYear] }, res.body);
});

test.serial('getTenderYears filters years by bidder', async (t) => {
  t.plan(2);
  const expectedYear = 2018;
  const alternativeYear = 2016;
  const bidder = await fixtures.build('rawBidder');
  await fixtures.build('rawBid', { bidders: [bidder] })
    .then((bid) => fixtures.build('rawLot', {
      bids: [bid],
      awardDecisionDate: `${expectedYear}-01-17`,
    }))
    .then((lot) => fixtures.build('rawFullTender', {
      lots: [lot],
    }))
    .then((ten) => writers.writeTender(ten, true));
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${alternativeYear}-01-17`,
  }).then((lot) => fixtures.build('rawFullTender', {
    lots: [lot],
  })).then((ten) => writers.writeTender(ten, true));
  const res = await request(app)
    .get(`/tenders/years?bidders[]=${bidder.id}`);

  t.is(res.status, codes.SUCCESS);
  await t.deepEqual({ years: [expectedYear] }, res.body);
});

test.serial('getTenderYears filters years by countries', async (t) => {
  t.plan(2);
  const expectedYear = 2018;
  const alternativeYear = 2016;
  const expectedCountry = 'CZ';
  const alternativeCountry = 'NL';
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${expectedYear}-01-17`,
  }).then((lot) => fixtures.build('rawFullTender', {
    lots: [lot],
    country: expectedCountry,
  })).then((ten) => writers.writeTender(ten, true));
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: `${alternativeYear}-01-17`,
  }).then((lot) => fixtures.build('rawFullTender', {
    lots: [lot],
    country: alternativeCountry,
  })).then((ten) => writers.writeTender(ten, true));
  const res = await request(app)
    .get(`/tenders/years?countries=${expectedCountry},PL`);

  t.is(res.status, codes.SUCCESS);
  await t.deepEqual({ years: [expectedYear] }, res.body);
});

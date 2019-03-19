'use strict';

const _ = require('lodash');
const request = require('supertest');
const test = require('ava');
const writers = require('../../../api/writers/tender');
const codes = require('../../../api/helpers/codes');
const config = require('../../../config/default');
const countrySerializer = require('../../../api/serializers/country');
const helpers = require('../../helpers');
const app = require('../../../server');
const fixtures = require('../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

function expectedResponse(countryCode) {
  return config.db.select()
    .from('Country')
    .where({ code: countryCode })
    .all()
    .then((countries) => ({
      countries: _.map(countries, (country) => countrySerializer.formatCountry(country)),
    }));
}
test.serial('getTenderCountries returns empty array if there are no bids', async (t) => {
  t.plan(2);
  const res = await request(app)
    .get('/tenders/countries');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual({ countries: [] }, res.body);
});

test.serial('getTenderCountries returns all cpvs by default', async (t) => {
  t.plan(2);
  const expectedCountry = 'CZ';
  await fixtures.build('rawFullTender', { country: expectedCountry })
    .then((rawTender) => writers.writeTender(rawTender));
  const res = await request(app)
    .get('/tenders/countries');

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse(expectedCountry), res.body);
});

test.serial('getTenderCountries filters countries by cpvs', async (t) => {
  t.plan(2);
  const cpv = await fixtures.build('rawCpv');
  const expectedCountry = 'CZ';
  const alternativeCountry = 'NL';
  await fixtures.build('rawFullTender', {
    cpvs: [cpv],
    country: expectedCountry,
  }).then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    country: alternativeCountry,
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/countries?cpvs=${cpv.code}`);

  t.is(res.status, codes.SUCCESS);
  t.deepEqual(await expectedResponse(expectedCountry), res.body);
});

test.serial('getTenderCountries filters countries by buyer', async (t) => {
  t.plan(2);
  const expectedCountry = 'CZ';
  const alternativeCountry = 'NL';
  const buyer = await fixtures.build('rawBuyer');
  await fixtures.build('rawFullTender', {
    buyers: [buyer],
    country: expectedCountry,
  }).then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    country: alternativeCountry,
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/countries?buyers[]=${buyer.id}`);

  t.is(res.status, codes.SUCCESS);
  await t.deepEqual(await expectedResponse(expectedCountry), res.body);
});

test.serial('getTenderCountries filters countries by bidder', async (t) => {
  t.plan(2);
  const expectedCountry = 'CZ';
  const alternativeCountry = 'NL';
  const bidder = await fixtures.build('rawBidder');
  await fixtures.build('rawBid', { bidders: [bidder] })
    .then((bid) => fixtures.build('rawLot', { bids: [bid] }))
    .then((lot) => fixtures.build('rawFullTender', {
      lots: [lot],
      country: expectedCountry,
    }))
    .then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    country: alternativeCountry,
  }).then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get(`/tenders/countries?bidders[]=${bidder.id}`);

  t.is(res.status, codes.SUCCESS);
  await t.deepEqual(await expectedResponse(expectedCountry), res.body);
});

test.serial('getTenderCountries filters countries by year', async (t) => {
  t.plan(2);
  const expectedCountry = 'CZ';
  const alternativeCountry = 'NL';
  await fixtures.build('rawLotWithBid', {
    awardDecisionDate: '2016-01-02',
  })
    .then((lot) => fixtures.build('rawFullTender', {
      lots: [lot],
      country: expectedCountry,
    }))
    .then((ten) => writers.writeTender(ten));
  await fixtures.build('rawLot', {
    awardDecisionDate: '2017-01-10',
  })
    .then((lot) => fixtures.build('rawFullTender', {
      lots: [lot],
      country: alternativeCountry,
    }))
    .then((ten) => writers.writeTender(ten));
  const res = await request(app)
    .get('/tenders/countries?years=2016,2017');

  t.is(res.status, codes.SUCCESS);
  await t.deepEqual(await expectedResponse(expectedCountry), res.body);
});

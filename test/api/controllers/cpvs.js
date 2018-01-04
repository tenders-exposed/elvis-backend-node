'use strict';

const _ = require('lodash');
const request = require('supertest');
const test = require('ava').test;
const writers = require('../../../api/writers');
const codes = require('../../../api/helpers/codes');
const config = require('../../../config/default');
const cpvController = require('../../../api/controllers/cpvs');
const helpers = require('../../helpers');
const app = require('../../../server');
const fixtures = require('../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

test.serial('listCpvs returns empty array if there are no cpvs', async (t) => {
  t.plan(2);
  const res = await request(app)
    .get('/cpvs');
  t.is(res.status, codes.SUCCESS);
  t.deepEqual({ cpvs: [] }, res.body);
});

test.serial('listCpvs returns all cpvs by default', async (t) => {
  t.plan(2);
  const cpvs = fixtures.assocAttrsMany('rawCpv', 2);
  await fixtures.build('rawFullTender', { cpvs })
    .then((rawTender) => writers.writeTender(rawTender));
  const expectedResponse = await config.db.select().from('CPV').all()
    .then((writtenCpvs) => ({
      cpvs: _.map(writtenCpvs, (cpv) => cpvController.formatCpv(cpv)),
    }));
  const res = await request(app)
    .get('/cpvs');
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(expectedResponse, res.body);
});

test.serial('listCpvs filters cpvs by country', async (t) => {
  t.plan(2);
  const rawMatchTender = await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    country: 'RO',
  }).then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    country: 'NL',
  }).then((ten) => writers.writeTender(ten));
  const expectedResponse = await config.db.select('expand(out("HasCPV"))')
    .from('Tender')
    .where({ id: rawMatchTender.id })
    .all()
    .then((writtenCpvs) => ({
      cpvs: _.map(writtenCpvs, (cpv) => cpvController.formatCpv(cpv)),
    }));
  const res = await request(app)
    .get('/cpvs?countries[]=RO');
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(expectedResponse, res.body);
});

test.serial('listCpvs filters cpvs by buyer', async (t) => {
  t.plan(2);
  const buyer = await fixtures.build('rawBuyer');
  const rawMatchTender = await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
    buyers: [buyer],
  }).then((ten) => writers.writeTender(ten));
  await fixtures.build('rawFullTender', {
    cpvs: fixtures.assocAttrsMany('rawCpv', 2),
  }).then((ten) => writers.writeTender(ten));

  const expectedResponse = await config.db.select('expand(out("HasCPV"))')
    .from('Tender')
    .where({ id: rawMatchTender.id })
    .all()
    .then((writtenCpvs) => ({
      cpvs: _.map(writtenCpvs, (cpv) => cpvController.formatCpv(cpv)),
    }));
  const res = await request(app)
    .get(`/cpvs?buyers[]=${buyer.id}`);
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(expectedResponse, res.body);
});

test.serial('listCpvs filters cpvs by bidder', async (t) => {
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

  const expectedResponse = await config.db.select('expand(out("HasCPV"))')
    .from('Tender')
    .where({ id: rawMatchTender.id })
    .all()
    .then((writtenCpvs) => ({
      cpvs: _.map(writtenCpvs, (cpv) => cpvController.formatCpv(cpv)),
    }));
  const res = await request(app)
    .get(`/cpvs?bidders[]=${bidder.id}`);
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(expectedResponse, res.body);
});

test.serial('listCpvs filters cpvs by year', async (t) => {
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

  const expectedResponse = await config.db.select('expand(out("HasCPV"))')
    .from('Tender')
    .where({ id: rawMatchTender.id })
    .all()
    .then((writtenCpvs) => ({
      cpvs: _.map(writtenCpvs, (cpv) => cpvController.formatCpv(cpv)),
    }));
  const res = await request(app)
    .get('/cpvs?years[]=2016');
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(expectedResponse, res.body);
});

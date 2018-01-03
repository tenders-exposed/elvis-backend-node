'use strict';

const _ = require('lodash');
const request = require('supertest');
const test = require('ava').test;
const helpers = require('../../helpers');
const codes = require('../../../api/helpers/codes');
const app = require('../../../server');
const factory = require('../../factory');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

test.serial('listCpvs returns empty array if there are no cpvs', async (t) => {
  t.plan(2);
  const res = await request(app)
    .get('/cpvs');
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(res.body, { cpvs: [] });
});

test.serial('listCpvs returns all cpvs by default', async (t) => {
  t.plan(2);
  const cpvs = await factory.createMany('cpv', 2);
  const expectedResponse = {
    cpvs: _.map(cpvs, (cpv) => cpv.formatJSON()),
  };
  const res = await request(app)
    .get('/cpvs');
  t.is(res.status, codes.SUCCESS);
  t.deepEqual(expectedResponse, res.body);
});


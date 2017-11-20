'use strict';

const _ = require('lodash');
const test = require('ava').test;
const config = require('./../../config/index')
const writers = require('./../../api/writers');
const helpers = require('./../helpers');
const fixtures = require('./../fixtures');

test.before((t) => helpers.createDB());
test.afterEach((t) => helpers.truncateDB());

test('writeTender creates new tender', async (t) => {
  const rawTender = await fixtures.build('rawTender');
  const writtenTender = await writers.writeTender(rawTender)
    .then(() => config.db.select().from('Tender')
      .where({ id: rawTender.id }).one());
  t.false(_.isUndefined(writtenTender['@rid']));
});

test('writeTender updates existing tender', async (t) => {
  const tenderAttrs = await fixtures.build('extractedTender', { country: 'NL' });
  const updatedTenderAttrs = await fixtures.build('rawTender', {
    country: 'BE',
    id: tenderAttrs.id,
  });
  const initialTender = await config.db.create('vertex', 'Tender')
    .set(tenderAttrs).commit().one();
  const updatedTender = await writers.writeTender(updatedTenderAttrs)
    .then(() => config.db.select().from('Tender')
      .where({ id: tenderAttrs.id }).one());
  t.is(initialTender.country, tenderAttrs.country);
  t.is(updatedTender.country, updatedTenderAttrs.country);
});

test('writeTender processes attached buyers', async (t) => {
  const rawBuyers = await fixtures.buildMany('rawBuyer', 2);
  const rawTender = await fixtures.build('rawTender', { buyers: rawBuyers });
  const writtenBuyers = writers.writeTender(rawTender)
    .then(() => config.db.select().from('Buyer').all());
  t.deepEqual(_.map(rawTender.buyers, 'id'), _.map(await writtenBuyers, 'id'));
});

'use strict';

const _ = require('lodash');
const test = require('ava');

const tenderExtractor = require('./../../extractors/tender');
const fixtures = require('./../fixtures');

test('extractTender extracts contract notice id from publications', async (t) => {
  const publication = await fixtures.build('rawContractNotice');
  const rawTender = await fixtures.build('rawTender');
  t.is(
    tenderExtractor.extractTender(rawTender, [], [publication]).xTEDCNID,
    publication.sourceId,
  );
});

test('extractTender returns null if there is no publication', async (t) => {
  const rawTender = await fixtures.build('rawTender');
  t.is(
    tenderExtractor.extractTender(rawTender, [], []).xTEDCNID,
    undefined,
  );
});

test('extractTender extracts year from contract notice if available', async (t) => {
  const publication = await fixtures.build('rawContractNotice', {
    publicationDate: '2015-11-03',
  });
  const rawTender = await fixtures.build('rawTender');
  t.is(
    tenderExtractor.extractTender(rawTender, [], [publication]).year,
    2015,
  );
});

test('extractTender extracts year from contract award notice if contract notice is not available', async (t) => {
  const publication = await fixtures.build('rawContractAwardNotice', {
    publicationDate: '2014-11-03',
  });
  const rawTender = await fixtures.build('rawTender');
  t.is(
    tenderExtractor.extractTender(rawTender, [], [publication]).year,
    2014,
  );
});

test('extractTender return undefined if no relevant publication is available', async (t) => {
  const rawTender = await fixtures.build('rawTender');
  t.is(
    tenderExtractor.extractTender(rawTender, [], []).year,
    undefined,
  );
});

test('extractTender filters indicators that match by id', async (t) => {
  const rawTender = await fixtures.build('rawTender');
  const indicators = await fixtures.buildMany('rawIndicator', 5);
  const goodIndicator = await fixtures.build('rawIndicator', { relatedEntityId: rawTender.id });
  const extractedTender = tenderExtractor.extractTender(
    rawTender,
    _.concat(indicators, goodIndicator),
  );
  t.deepEqual(_.map(extractedTender.indicators, 'id'), [goodIndicator.id]);
});

test('extractTender returns empty array if there are no indicators', async (t) => {
  const rawTender = await fixtures.build('rawTender');
  t.deepEqual(
    tenderExtractor.extractTender(rawTender, []).indicators,
    [],
  );
});

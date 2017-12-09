'use strict';

const test = require('ava').test;

const bidExtractor = require('./../../extractors/bid');
const fixtures = require('./../fixtures');

test('extractBid extracts contract award notice id from publications', async (t) => {
  const publication = await fixtures.build('rawContractAwardNotice');
  const rawBid = await fixtures.build('rawBid');
  t.is(
    bidExtractor.extractBid(rawBid, [publication]).xTEDCANID,
    publication.sourceId,
  );
});

test('extractBid returns null if there is no publication', async (t) => {
  const rawBid = await fixtures.build('rawBid');
  t.is(
    bidExtractor.extractBid(rawBid, []).xTEDCANID,
    undefined,
  );
});

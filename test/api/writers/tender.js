'use strict';

const _ = require('lodash');
const test = require('ava');
const OrientDBError = require('orientjs/lib/errors');

const config = require('../../../config/default');
const writers = require('./../../../api/writers/tender');
const helpers = require('./../../helpers');
const fixtures = require('./../../fixtures');

test.before(() => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

test.serial('writeTender creates new tender', async (t) => {
  const rawTender = await fixtures.build('rawFullTender');
  const writtenTender = await writers.writeTender(rawTender)
    .then(() => config.db.select()
      .from('Tender')
      .where({ id: rawTender.id })
      .one());
  t.false(_.isUndefined(writtenTender));
});

test.serial('writeTender updates indicators', async (t) => {
  t.plan(2);
  const rawTender = await fixtures.build('rawFullTender');
  const firstIndicator = await fixtures.build('rawIndicator', {
    relatedEntityId: rawTender.id,
    value: 1,
  });
  rawTender.indicators = [firstIndicator];
  await writers.writeTender(rawTender);
  const secondIndicator = await fixtures.build('rawIndicator', {
    relatedEntityId: rawTender.id,
  });
  const newValue = 43;
  firstIndicator.value = newValue;
  rawTender.indicators = [firstIndicator, secondIndicator];
  const updatedTender = await writers.writeTender(rawTender)
    .then(() => config.db.select()
      .from('Tender')
      .where({ id: rawTender.id })
      .one());
  t.is(updatedTender.indicators.length, 2);
  t.is(_.find(updatedTender.indicators, { id: firstIndicator.id }).value, newValue);
});

test.serial('writeTender updates existing tender', async (t) => {
  t.plan(2);
  const tenderAttrs = await fixtures.build('extractedTender', { country: 'NL' });
  const updatedTenderAttrs = await fixtures.build('rawFullTender', {
    country: 'BE',
    id: tenderAttrs.id,
  });
  const existingTender = await config.db.create('vertex', 'Tender')
    .set(tenderAttrs)
    .commit()
    .one();
  const updatedTender = await writers.writeTender(updatedTenderAttrs)
    .then(() => config.db.select().from('Tender')
      .where({ id: tenderAttrs.id })
      .one());
  t.is(updatedTender['@rid'].toString(), existingTender['@rid'].toString());
  t.is(updatedTender.country, updatedTenderAttrs.country);
});

test.serial('writeTender rolls back transaction on error', async (t) => {
  t.plan(2);
  const wrongTenderAttrs = await fixtures.build('rawFullTender', { isFrameworkAgreement: 'I should be a boolean' });
  await t.throwsAsync(
    writers.writeTender(wrongTenderAttrs),
    { instanceOf: OrientDBError.RequestError },
  );
  const writtenTender = await config.db.select()
    .from('Tender')
    .where({ id: wrongTenderAttrs.id })
    .one();
  t.is(writtenTender, undefined);
});

// I delierately avoid testing deleteLot and createLot separately instead of this
// because their purpose is to perform an update in the absence of a unique lot id
test.serial('writeTender updates existing lots', async (t) => {
  t.plan(2);
  const existingLot = await fixtures.build('extractedLot', { title: 'existing lot' })
    .then((lotAttrs) => config.db.create('vertex', 'Lot')
      .set(lotAttrs)
      .commit()
      .one());
  const existingTender = await fixtures.build('extractedTender')
    .then((tenderAttrs) => config.db.create('vertex', 'Tender')
      .set(tenderAttrs)
      .commit()
      .one());
  await config.db.create('edge', 'Comprises')
    .from(existingTender['@rid'])
    .to(existingLot['@rid'])
    .commit()
    .one();
  const updatedLotAttrs = await fixtures.build('rawLot', { title: 'replacement lot' });
  const updatedTenderAttrs = await fixtures.build('rawTender', {
    lots: [updatedLotAttrs],
    id: existingTender.id,
  });

  await writers.writeTender(updatedTenderAttrs);
  const updatedTenderLots = await config.db.select()
    .from(config.db.traverse('out("Comprises")')
      .from(existingTender['@rid'])
      .while('$depth < 2'))
    .where('$depth = 1').all();
  t.is(updatedTenderLots.length, 1);
  t.is(updatedTenderLots[0].title, updatedLotAttrs.title);
});

// I delierately avoid testing createBid and deleteBit separately instead of this
// because their purpose is to perform an update in the absence of a unique bid id
test.serial('writeTender updates existing bids', async (t) => {
  t.plan(2);
  const existingBid = await fixtures.build('extractedBid', { isWinning: false })
    .then((bidAttrs) => config.db.create('vertex', 'Bid')
      .set(bidAttrs)
      .commit()
      .one());
  const existingLot = await fixtures.build('extractedLot')
    .then((lotAttrs) => config.db.create('vertex', 'Lot')
      .set(lotAttrs)
      .commit()
      .one());
  const existingTender = await fixtures.build('extractedTender')
    .then((tenderAttrs) => config.db.create('vertex', 'Tender')
      .set(tenderAttrs)
      .commit()
      .one());
  await config.db.create('edge', 'AppliedTo')
    .from(existingBid['@rid'])
    .to(existingLot['@rid'])
    .commit()
    .one();
  await config.db.create('edge', 'Comprises')
    .from(existingTender['@rid'])
    .to(existingLot['@rid'])
    .commit()
    .one();
  const updatedBidAttrs = await fixtures.build('rawBid', { isWinning: true });
  const updatedLotAttrs = await fixtures.build('rawLot', { bids: [updatedBidAttrs] });
  const updatedTenderAttrs = await fixtures.build('rawTender', {
    lots: [updatedLotAttrs],
    id: existingTender.id,
  });
  await writers.writeTender(updatedTenderAttrs);
  const tenderBids = await config.db.select()
    .from(config.db.traverse('out("Comprises"), in("AppliedTo")')
      .from(existingTender['@rid'])
      .while('$depth < 3'))
    .where('$depth = 2').all();
  t.is(tenderBids.length, 1);
  t.is(tenderBids[0].isWinning, updatedBidAttrs.isWinning);
});

test.serial('upsertBuyer creates a new buyer', async (t) => {
  const rawBuyer = await fixtures.build('rawBuyer');
  const tenderName = 'tender';
  const transaction = await fixtures.build('extractedTender').then((tender) =>
    config.db.let(tenderName, (tr) =>
      tr.create('vertex', 'Tender')
        .set(tender)));
  const writtenBuyer = await writers.upsertBuyer(transaction, rawBuyer, undefined, tenderName)
    .then((buyerName) => transaction.commit()
      .return(`$${buyerName}`)
      .one());
  t.false(_.isUndefined(writtenBuyer));
});

test.serial('upsertBuyer creates an edge between tender and buyer', async (t) => {
  const rawBuyer = await fixtures.build('rawBuyer');
  const rawTender = await fixtures.build('extractedTender');
  const tenderName = 'tender';
  const transaction = config.db.let(tenderName, (tr) =>
    tr.create('vertex', 'Tender').set(rawTender));
  const writtenBuyer = await writers.upsertBuyer(transaction, rawBuyer, undefined, tenderName)
    .then((buyerName) => transaction.commit().return(`$${buyerName}`).one());
  const writtenTender = await config.db.select().from('Tender')
    .where({ id: rawTender.id })
    .one();
  const writtenEdges = await config.db.select()
    .from('Creates')
    .where({ out: writtenBuyer['@rid'], in: writtenTender['@rid'] })
    .all();
  t.is(writtenEdges.length, 1);
});

test.serial('upsertBuyer updates an existing buyer', async (t) => {
  t.plan(2);
  const buyerAttrs = await fixtures.build('extractedBuyer', { isPublic: true });
  const updatedAttrs = await fixtures.build('rawBuyer', {
    isPublic: false,
    id: buyerAttrs.id,
  });
  const existingBuyer = await config.db.create('vertex', 'Buyer')
    .set(buyerAttrs)
    .commit()
    .one();
  const tenderName = 'tender';
  const transaction = await fixtures.build('extractedTender').then((tender) =>
    config.db.let(tenderName, (tr) =>
      tr.create('vertex', 'Tender')
        .set(tender)));
  const updatedBuyer = await writers.upsertBuyer(transaction, updatedAttrs, undefined, tenderName)
    .then((buyerName) => transaction.commit()
      .return(`$${buyerName}`)
      .one());
  t.is(updatedBuyer['@rid'].toString(), existingBuyer['@rid'].toString());
  t.is(updatedBuyer.isPublic, updatedAttrs.isPublic);
});

test.serial('upsertBuyer updates the edge between existing buyer and existing tender', async (t) => {
  t.plan(3);
  const tenderAttrs = await fixtures.build('extractedTender');
  const edgeAttrs = { isLeader: true };
  const existingBuyer = await fixtures.build('extractedBuyer')
    .then((extractedBuyer) => config.db.create('vertex', 'Buyer')
      .set(extractedBuyer)
      .commit()
      .one());
  const existingTender = await config.db.create('vertex', 'Tender')
    .set(tenderAttrs)
    .commit()
    .one();
  const existingEdge = await config.db.create('edge', 'Creates')
    .from(existingBuyer['@rid']).to(existingTender['@rid'])
    .set(edgeAttrs)
    .commit()
    .one();
  const updatedBuyerAttrs = await fixtures.build('rawBuyer', {
    isLeader: false,
    id: existingBuyer.id,
  });
  const tenderName = 'tender';
  const transaction = await config.db.let(tenderName, (tr) =>
    tr.update(existingTender['@rid']).set(tenderAttrs));
  await writers.upsertBuyer(transaction, updatedBuyerAttrs, existingTender['@rid'], tenderName)
    .then(() => transaction.commit()
      .return(`$${tenderName}`)
      .one());
  const writtenEdges = await config.db.select()
    .from('Creates')
    .where({ out: existingBuyer['@rid'], in: existingTender['@rid'] })
    .all();
  t.is(writtenEdges.length, 1);
  t.is(writtenEdges[0]['@rid'].toString(), existingEdge['@rid'].toString());
  t.is(writtenEdges[0].isLeader, updatedBuyerAttrs.isLeader);
});

test.serial('createBid creates an edge between bid and buyers', async (t) => {
  const rawTender = await fixtures.create('rawTender');
  const rawBid = await fixtures.create('rawBid');
  const rawLot = await fixtures.create('extractedLot');
  const rawBuyer = await fixtures.create('extractedBuyer');
  const buyerName = 'buyer';
  const lotName = 'lot';
  const transaction = config.db.let(buyerName, (tr) =>
    tr.create('vertex', 'Buyer').set(rawBuyer));
  transaction.let(lotName, (tr) =>
    tr.create('vertex', 'Lot').set(rawLot));
  const writtenBid = await writers.createBid(transaction, rawBid, lotName, [buyerName], [], rawTender, {}) // eslint-disable-line max-len
    .then((bidName) => transaction.commit()
      .return(`$${bidName}`)
      .one());
  const writtenBuyer = await config.db.select()
    .from('Buyer')
    .where({ id: rawBuyer.id })
    .one();
  const writtenEdges = await config.db.select()
    .from('Awards')
    .where({ out: writtenBuyer['@rid'], in: writtenBid['@rid'] })
    .all();
  t.is(writtenEdges.length, 1);
});

test.serial('upsertBidder creates a new bidder', async (t) => {
  const rawBidder = await fixtures.build('rawBidder');
  const bidName = 'bid';
  const transaction = await fixtures.build('extractedBid').then((bid) =>
    config.db.let(bidName, (tr) =>
      tr.create('vertex', 'Bid')
        .set(bid)));
  const writtenBidder = await writers.upsertBidder(transaction, rawBidder, bidName)
    .then((bidderName) => transaction.commit()
      .return(`$${bidderName}`)
      .one());
  t.false(_.isUndefined(writtenBidder));
});

test.serial('upsertBidder creates an edge between bidder and bid', async (t) => {
  const rawBidder = await fixtures.build('rawBidder');
  const bidName = 'bid';
  const transaction = await fixtures.build('extractedBid')
    .then((extractedBid) => config.db.let(bidName, (tr) =>
      tr.create('vertex', 'Bid')
        .set(extractedBid)));
  await writers.upsertBidder(transaction, rawBidder, bidName);
  const writtenBid = await transaction.commit()
    .return(`$${bidName}`)
    .one();
  const writtenBidder = await config.db.select()
    .from('Bidder')
    .where({ id: rawBidder.id })
    .one();
  const writtenEdges = await config.db.select()
    .from('Participates')
    .where({ out: writtenBidder['@rid'], in: writtenBid['@rid'] })
    .all();
  t.is(writtenEdges.length, 1);
});

test.serial('upsertBidder avoids issue #35', async (t) => {
  const rawBidder = await fixtures.build('rawBidder');
  const firstBid = await fixtures.build('extractedBid');
  const secondBid = await fixtures.build('extractedBid');
  const firstBidName = 'bid1';
  const secondBidName = 'bid2';
  const transaction = config.db.let(firstBidName, (tr) =>
    tr.create('vertex', 'Bid')
      .set(firstBid));
  transaction.let(secondBidName, (tr) =>
    tr.create('vertex', 'Bid')
      .set(secondBid));
  await writers.upsertBidder(transaction, rawBidder, firstBidName);
  await writers.upsertBidder(transaction, rawBidder, secondBidName);
  await transaction.commit()
    .return()
    .one();
  const writtenBidder = await config.db.select()
    .from('Bidder')
    .where({ id: rawBidder.id })
    .one();
  const writtenEdges = await config.db.select()
    .from('Participates')
    .where({ out: writtenBidder['@rid'] })
    .all();
  t.not(writtenBidder, undefined);
  t.is(writtenEdges.length, 2);
});

test.serial('upsertBidder updates an existing bidder', async (t) => {
  t.plan(2);
  const bidderAttrs = await fixtures.build('extractedBidder', { isPublic: true });
  const updatedAttrs = await fixtures.build('rawBidder', {
    isPublic: false,
    id: bidderAttrs.id,
  });
  const existingBidder = await config.db.create('vertex', 'Bidder')
    .set(bidderAttrs)
    .commit()
    .one();
  const bidName = 'bid';
  const transaction = await fixtures.build('extractedBid')
    .then((extractedBid) => config.db.let(bidName, (tr) =>
      tr.create('vertex', 'Bid')
        .set(extractedBid)));
  const updatedBidder = await writers.upsertBidder(transaction, updatedAttrs, bidName)
    .then((bidderName) => transaction.commit()
      .return(`$${bidderName}`)
      .one());
  t.is(updatedBidder['@rid'].toString(), existingBidder['@rid'].toString());
  t.is(updatedBidder.isPublic, updatedAttrs.isPublic);
});

test.serial('upsertCpv creates a new CPV', async (t) => {
  const rawCpv = await fixtures.build('rawCpv');
  const tenderName = 'tender';
  const transaction = await fixtures.build('extractedTender').then((tender) =>
    config.db.let(tenderName, (tr) =>
      tr.create('vertex', 'Tender')
        .set(tender)));
  const writtenCpv = await writers.upsertCpv(transaction, rawCpv, undefined, tenderName)
    .then((cpvName) => transaction.commit()
      .return(`$${cpvName}`)
      .one());
  t.false(_.isUndefined(writtenCpv));
});

test.serial('upsertCpv creates an edge between CPV and tender', async (t) => {
  const rawCpv = await fixtures.build('rawCpv');
  const rawTender = await fixtures.build('extractedTender');
  const tenderName = 'tender';
  const transaction = config.db.let(tenderName, (tr) =>
    tr.create('vertex', 'Tender')
      .set(rawTender));
  const writtenCpv = await writers.upsertCpv(transaction, rawCpv, undefined, tenderName)
    .then((cpvName) => transaction.commit()
      .return(`$${cpvName}`)
      .one());
  const writtenTender = await config.db.select()
    .from('Tender')
    .where({ id: rawTender.id })
    .one();
  const writtenEdges = await config.db.select()
    .from('HasCPV')
    .where({ out: writtenTender['@rid'], in: writtenCpv['@rid'] })
    .all();
  t.is(writtenEdges.length, 1);
});

test.serial('upsertCpv updates the edge between existing CPV and existing tender', async (t) => {
  t.plan(3);
  const tenderAttrs = await fixtures.build('extractedTender');
  const edgeAttrs = { isMain: true };
  const existingCpv = await fixtures.build('extractedCpv')
    .then((extractedCpv) =>
      config.db.create('vertex', 'CPV')
        .set(extractedCpv)
        .commit()
        .one());
  const existingTender = await config.db.create('vertex', 'Tender')
    .set(tenderAttrs)
    .commit()
    .one();
  const existingEdge = await config.db.create('edge', 'HasCPV')
    .from(existingTender['@rid'])
    .to(existingCpv['@rid'])
    .set(edgeAttrs)
    .commit()
    .one();
  const updatedCpvAttrs = await fixtures.build('rawCpv', {
    isMain: false,
    code: existingCpv.code,
  });
  const tenderName = 'tender';
  const transaction = await config.db.let(tenderName, (tr) =>
    tr.update(existingTender['@rid']).set(tenderAttrs));
  await writers.upsertCpv(transaction, updatedCpvAttrs, existingTender['@rid'], tenderName)
    .then(() => transaction.commit()
      .return(`$${tenderName}`)
      .one());
  const writtenEdges = await config.db.select()
    .from('HasCPV')
    .where({ out: existingTender['@rid'], in: existingCpv['@rid'] })
    .all();
  t.is(writtenEdges.length, 1);
  t.is(writtenEdges[0]['@rid'].toString(), existingEdge['@rid'].toString());
  t.is(writtenEdges[0].isMain, updatedCpvAttrs.isMain);
});

test.serial('upsertCpv allows cpv to have edges to more than one tender', async (t) => {
  t.plan(2);
  const rawCpv = await fixtures.build('rawCpv');
  const firstTenderName = 'tender1';
  const secondTenderName = 'tender2';
  const firstTender = await fixtures.build('extractedTender')
    .then((rawTender) => config.db.let(firstTenderName, (tr) =>
      tr.create('vertex', 'Tender')
        .set(rawTender)))
    .then((transaction) => writers.upsertCpv(transaction, rawCpv, undefined, firstTenderName)
      .then(() => transaction.commit()
        .return(`$${firstTenderName}`)
        .one()));
  const secondTender = await fixtures.build('extractedTender')
    .then((rawTender) => config.db.let(secondTenderName, (tr) =>
      tr.create('vertex', 'Tender')
        .set(rawTender)))
    .then((transaction) => writers.upsertCpv(transaction, rawCpv, undefined, secondTenderName)
      .then(() => transaction.commit()
        .return(`$${secondTenderName}`)
        .one()));
  const writtenCpv = await config.db.select().from('CPV')
    .where({ code: rawCpv.code })
    .one();
  const writtenEdges = await config.db.select().from('HasCPV')
    .where({ in: writtenCpv['@rid'] })
    .all();
  t.is(writtenEdges.length, 2);
  t.deepEqual(
    _.sortBy([firstTender['@rid'].toString(), secondTender['@rid'].toString()]),
    _.sortBy(_.map(writtenEdges, (edge) => edge.out.toString())),
  );
});

test.serial('hasMilitaryCPV returns false if none of the CPVs is military', async (t) => {
  t.plan(1);
  const militaryCpv = await fixtures.build('rawCpv', {
    code: '35613000',
    military: true,
  });
  await config.db.create('vertex', 'CPV')
    .set(militaryCpv)
    .commit()
    .one();
  const nonMilitaryCpv = await fixtures.build('rawCpv', { code: '03222111' });
  const nonMilitaryCpv2 = await fixtures.build('rawCpv', { code: '03222112' });
  t.is(await writers.hasMilitaryCpv([nonMilitaryCpv, nonMilitaryCpv2]), false);
});

test.serial('hasMilitaryCPV returns true if at least one of the CPVs is military', async (t) => {
  t.plan(1);
  const militaryCpv = await fixtures.build('rawCpv', {
    code: '35613000',
    military: true,
  });
  await config.db.create('vertex', 'CPV')
    .set(militaryCpv)
    .commit()
    .one();
  const nonMilitaryCpv = await fixtures.build('rawCpv', { code: '03222111' });
  t.is(await writers.hasMilitaryCpv([nonMilitaryCpv, militaryCpv]), true);
});

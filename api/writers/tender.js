'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuidv4 = require('uuid/v4');

const config = require('../../config/default');
const tenderExtractor = require('./../../extractors/tender');
const buyerExtractor = require('./../../extractors/buyer');
const lotExtractor = require('./../../extractors/lot');
const bidExtractor = require('./../../extractors/bid');
const bidderExtractor = require('./../../extractors/bidder');
const cpvExtractor = require('./../../extractors/cpv');

function recordName(id, className) {
  return `${className.toLowerCase()}${id.replace(/-/g, '')}`;
}

// Returns true
// Raises OrientDBError if the writing failed
async function writeTender(fullTenderRecord) {
  const tender = tenderExtractor.extractTender(
    _.omit(fullTenderRecord, ['indicators', 'publications']),
    fullTenderRecord.indicators,
    fullTenderRecord.publications,
  );
  const tenderName = recordName(tender.id, 'Tender');

  const existingTender = await config.db.select().from('Tender')
    .where({ id: tender.id }).one();
  const existingTenderID = (existingTender || {})['@rid'];
  const transaction = config.db.let(tenderName, (t) => {
    if (_.isUndefined(existingTender)) {
      t.create('vertex', 'Tender')
        .set(tender);
    } else {
      t.update('Tender')
        .set(tender)
        .where({ '@rid': existingTenderID })
        .return('AFTER');
    }
  });

  // TODO: Remove this filter by id after empty objects are excluded from the Digiwhist dumps
  const buyerNames = await Promise.map(
    _.filter(fullTenderRecord.buyers, (rawBuyer) => rawBuyer.id),
    (rawBuyer) => upsertBuyer(transaction, rawBuyer, existingTenderID, tenderName, fullTenderRecord), // eslint-disable-line max-len
  );

  if (_.isUndefined(existingTender) === false) {
    const existingLotRel = await config.db.select("out('Comprises')").from('Tender')
      .where({ '@rid': existingTenderID }).one();
    const existingLotRIDs = existingLotRel.out;
    await Promise.map(existingLotRIDs, (existingLotRID) =>
      deleteLot(transaction, existingLotRID));
  }

  await Promise.map((fullTenderRecord.lots || []), (rawLot) => {
    rawLot.awardCriteria = rawLot.awardCriteria || fullTenderRecord.awardCriteria;
    return createLot(transaction, rawLot, tenderName, buyerNames, fullTenderRecord);
  });

  await Promise.map((fullTenderRecord.cpvs || []), (rawCpv) =>
    upsertCpv(transaction, rawCpv, existingTenderID, tenderName));

  return transaction.commit(2).return(`$${tenderName}`).one();
}

async function deleteLot(transaction, lotRID) {
  const lotName = `delete${recordName(uuidv4(), 'Lot')}`;

  transaction.let(lotName, (t) =>
    t.delete('vertex', 'Lot')
      .where({ '@rid': lotRID }));

  const existingBidRel = await config.db.select("in('AppliedTo')").from('Lot')
    .where({ '@rid': lotRID }).one();
  const existingBidRIDs = existingBidRel.in;
  await Promise.map(existingBidRIDs, (existingBidRID) =>
    deleteBid(transaction, existingBidRID));
  return lotName;
}

async function deleteBid(transaction, bidRID) {
  const bidName = `delete${recordName(uuidv4(), 'Bid')}`;

  transaction.let(bidName, (t) =>
    t.delete('vertex', 'Bid')
      .where({ '@rid': bidRID }));
  return bidName;
}

async function createLot(transaction, rawLot, tenderName, buyerNames, rawTender) { // eslint-disable-line max-len
  const rawBids = (rawLot.bids || []);
  const lot = lotExtractor.extractLot(rawLot);
  lot.bidsCount = lot.bidsCount || rawBids.length;
  const lotName = recordName(uuidv4(), 'Lot');

  transaction.let(lotName, (t) => {
    t.create('vertex', 'Lot')
      .set(lot);
  }).let(`${tenderName}comprises${lotName}`, (t) => {
    t.create('edge', 'Comprises')
      .from(`$${tenderName}`)
      .to(`$${lotName}`);
  });

  await Promise.map(rawBids, (rawBid) =>
    createBid(transaction, rawBid, lotName, buyerNames, rawTender, rawLot));
  return lotName;
}

async function createBid(transaction, rawBid, lotName, buyerNames, rawTender, rawLot) { // eslint-disable-line max-len
  const bid = bidExtractor.extractBid(rawBid, rawTender, rawLot);
  const bidName = recordName(uuidv4(), 'Bid');

  transaction.let(bidName, (t) => {
    t.create('vertex', 'Bid')
      .set(bid);
  }).let(`${bidName}appliedTo${lotName}`, (t) => {
    t.create('edge', 'AppliedTo')
      .from(`$${bidName}`)
      .to(`$${lotName}`);
  });

  await Promise.map(_.flatten([buyerNames]), (buyerName) =>
    transaction.let(`${buyerName}awards${bidName}`, (t) => {
      t.create('edge', 'Awards')
        .from(`$${buyerName}`)
        .to(`$${bidName}`);
    }));

  // TODO: Remove this filter by id after empty objects are excluded from the Digiwhist dumps
  await Promise.map(
    (rawBid.bidders || []).filter((rawBidder) => rawBidder.id),
    (rawBidder) => upsertBidder(transaction, rawBidder, bidName, rawTender),
  );
  return bidName;
}

async function upsertBuyer(transaction, rawBuyer, existingTenderID, tenderName, rawTender = {}) {
  const buyer = buyerExtractor.extractBuyer(rawBuyer, rawTender);
  const buyerName = recordName(rawBuyer.id, 'Buyer');

  const existingBuyer = await config.db.select().from('Buyer')
    .where({ id: buyer.id }).one();
  const existingBuyerID = (existingBuyer || {})['@rid'];
  if (_.isUndefined(existingBuyer)) {
    transaction.let(buyerName, (t) => {
      t.create('vertex', 'Buyer')
        .set(buyer);
    });
  } else {
    transaction.let(buyerName, (t) => {
      t.update('Buyer')
        .set(buyer)
        .where({ '@rid': existingBuyer['@rid'] })
        .return('AFTER');
    });
  }

  const existingRel = await config.db.select().from('Creates')
    .where({
      in: (existingTenderID || null),
      out: (existingBuyerID || null),
    }).one();
  transaction.let(`${buyerName}creates${tenderName}`, (t) => {
    if (_.isUndefined(existingRel)) {
      t.create('edge', 'Creates')
        .from(`$${buyerName}`)
        .to(`$${tenderName}`)
        .set(buyerExtractor.extractCreates(rawBuyer));
    } else {
      t.update('Creates')
        .set(buyerExtractor.extractCreates(rawBuyer))
        .where({ '@rid': existingRel['@rid'] })
        .return('AFTER');
    }
  });
  return buyerName;
}

async function upsertBidder(transaction, rawBidder, bidName, rawTender = {}) {
  const bidder = bidderExtractor.extractBidder(rawBidder, rawTender);
  const bidderName = recordName(rawBidder.id, 'Bidder');

  const existingBidder = await config.db.select().from('Bidder')
    .where({ id: bidder.id }).one();
  if (_.isUndefined(existingBidder)) {
    transaction.let(bidderName, (t) => {
      t.create('vertex', 'Bidder')
        .set(bidder);
    });
  } else {
    transaction.let(bidderName, (t) => {
      t.update('Bidder')
        .set(bidder)
        .where({ '@rid': existingBidder['@rid'] })
        .return('AFTER');
    });
  }

  transaction.let(`${bidderName}participates${bidName}`, (t) => {
    t.create('edge', 'Participates')
      .from(`$${bidderName}`)
      .to(`$${bidName}`)
      .set(bidderExtractor.extractParticipates(rawBidder));
  });
  return bidderName;
}

async function upsertCpv(transaction, rawCpv, existingTenderID, tenderName) {
  const cpv = cpvExtractor.extractCpv(rawCpv);
  const cpvName = recordName(rawCpv.code, 'CPV');

  const existingCpv = await config.db.select().from('CPV')
    .where({ code: cpv.code }).one();
  const existingCpvID = (existingCpv || {})['@rid'];
  if (_.isUndefined(existingCpv)) {
    transaction.let(cpvName, (t) => {
      t.create('vertex', 'CPV')
        .set(cpv);
    });
  } else {
    transaction.let(cpvName, (t) => {
      t.update('CPV')
        .set(cpv)
        .where({ '@rid': existingCpv['@rid'] })
        .return('AFTER');
    });
  }

  const existingRel = await config.db.select().from('HasCPV')
    .where({
      // This is needed because undefined confuses OrientDB
      in: (existingCpvID || null),
      out: (existingTenderID || null),
    }).one();
  transaction.let(`${tenderName}has${cpvName}`, (t) => {
    if (_.isUndefined(existingRel)) {
      t.create('edge', 'HasCPV')
        .from(`$${tenderName}`)
        .to(`$${cpvName}`)
        .set(cpvExtractor.extractHasCpv(rawCpv));
    } else {
      t.update('HasCPV')
        .set(cpvExtractor.extractHasCpv(rawCpv))
        .where({ '@rid': existingRel['@rid'] })
        .return('AFTER');
    }
  });
  return cpvName;
}

module.exports = {
  writeTender,
  upsertBuyer,
  upsertBidder,
  upsertCpv,
  deleteLot,
  deleteBid,
  createLot,
  createBid,
};

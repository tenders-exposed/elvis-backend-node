'use strict';

const _ = require('lodash');
const fs = require('fs');
const Promise = require('bluebird');
const readline = require('readline');
const uuidv4 = require('uuid/v4');

const config = require('./../config');
const tenderExtractor = require('./../extractors/tender');
const buyerExtractor = require('./../extractors/buyer');
const lotExtractor = require('./../extractors/lot');
const bidExtractor = require('./../extractors/bid');
const bidderExtractor = require('./../extractors/bidder');
const cpvExtractor = require('./../extractors/cpv');

function recordName(id, className) {
  return `${className.toLowerCase()}${id.replace(/-/g, '')}`;
}

async function createBid(transaction, rawBid, lotName, buyerNames) {
  const bid = bidExtractor.extractBid(rawBid);
  const bidName = recordName(uuidv4(), 'Bid');

  transaction.let(bidName, (t) => {
    t.create('vertex', 'Bid')
      .set(bid);
  }).let(`${bidName}appliedTo${lotName}`, (t) => {
    t.create('edge', 'AppliedTo')
      .from(`$${bidName}`)
      .to(`$${lotName}`);
  });

  await Promise.map((buyerNames || []), (buyerName) =>
    transaction.let(`${buyerName}awards${bidName}`, (t) => {
      t.create('edge', 'Awards')
        .from(`$${buyerName}`)
        .to(`$${bidName}`);
    }));

  // TODO: Remove this filter by id after empty objects are excluded from the dumps
  return Promise.map((rawBid.bidders || []).filter((bidder) => bidder.id), (rawBidder) =>
    upsertBidder(transaction, rawBidder, rawBid, bidName));
}

async function deleteBid(transaction, bidID) {
  const bidName = `delete${recordName(uuidv4(), 'Bid')}`;

  transaction.let(bidName, (t) =>
    t.delete('vertex', 'Bid')
      .where({ '@rid': bidID }));

  return transaction;
}

async function createLot(transaction, rawLot, rawTender, tenderName, buyerNames) {
  rawLot.bidsCount = rawLot.bids.length;
  const lot = lotExtractor.extractLot(rawLot);
  const lotName = recordName(uuidv4(), 'Lot');

  transaction.let(lotName, (t) => {
    t.create('vertex', 'Lot')
      .set(lot);
  }).let(`${tenderName}comprises${lotName}`, (t) => {
    t.create('edge', 'Comprises')
      .from(`$${tenderName}`)
      .to(`$${lotName}`);
  });

  return Promise.map(rawLot.bids, (rawBid) =>
    createBid(transaction, rawBid, lotName, buyerNames));
}

async function deleteLot(transaction, lotID) {
  const lotName = `delete${recordName(uuidv4(), 'Lot')}`;

  transaction.let(lotName, (t) =>
    t.delete('vertex', 'Lot')
      .where({ '@rid': lotID }));

  const existingBidRel = await config.db.select("in('AppliedTo')").from('Lot')
    .where({ '@rid': lotID }).one();
  const existingBidIDs = existingBidRel.in;
  return Promise.map(existingBidIDs, (existingBidID) =>
    deleteBid(transaction, existingBidID.toString()));
}

async function upsertBuyer(transaction, rawBuyer, rawTender, tenderName) {
  const buyer = buyerExtractor.extractBuyer(rawBuyer);
  const buyerName = recordName(rawBuyer.id, 'Buyer');

  // TODO: Sometimes this returns undefined even though the buyer exists
  const existingBuyer = await config.db.select().from('Buyer')
    .where({ id: rawBuyer.id }).one();
  if (_.isUndefined(existingBuyer)) {
    transaction.let(buyerName, (t) => {
      t.create('vertex', 'Buyer')
        .set(buyer);
    }).let(`${buyerName}creates${tenderName}`, (t) => {
      t.create('edge', 'Creates')
        .from(`$${buyerName}`)
        .to(`$${tenderName}`)
        .set(buyerExtractor.extractCreates(rawBuyer, rawTender));
    });
  } else {
    transaction.let(buyerName, (t) => {
      t.update('Buyer')
        .set(buyer)
        .where({ id: rawBuyer.id })
        .return('AFTER');
    });
  }
  return buyerName;
}

async function upsertBidder(transaction, rawBidder, rawBid, bidName) {
  const bidder = bidderExtractor.extractBidder(rawBidder);
  const bidderName = recordName(rawBidder.id, 'Bidder');

  const existingBidder = await config.db.select().from('Bidder')
    .where({ id: rawBidder.id }).one();
  if (_.isUndefined(existingBidder)) {
    transaction.let(bidderName, (t) => {
      t.create('vertex', 'Bidder')
        .set(bidder);
    }).let(`${bidderName}participates${bidName}`, (t) => {
      t.create('edge', 'Participates')
        .from(`$${bidderName}`)
        .to(`$${bidName}`)
        .set(bidderExtractor.extractParticipates(rawBidder, rawBid));
    });
  } else {
    transaction.let(bidderName, (t) => {
      t.update('Bidder')
        .set(bidder)
        .where({ id: rawBidder.id })
        .return('AFTER');
    });
  }
  return bidderName;
}

async function upsertCPV(transaction, rawCPV, rawTender, tenderName) {
  const cpv = cpvExtractor.extractCPV(rawCPV);
  const cpvName = recordName(rawCPV.code, 'CPV');

  const existingCPVID = await config.db.select('@rid').from('CPV')
    .where({ code: rawCPV.code }).one();
  if (_.isUndefined(existingCPVID)) {
    transaction.let(cpvName, (t) => {
      t.create('vertex', 'CPV')
        .set(cpv);
    });
  }

  const existingTenderID = await config.db.select('@rid').from('Tender')
    .where({ id: rawTender.id }).one();
  const existingRelID = await config.db.select('@rid').from('HasCPV')
    .where({
      in: (existingTenderID || {}).rid,
      out: (existingCPVID || {}).rid,
    }).one();
  transaction.let(`${tenderName}has${cpvName}`, (t) => {
    if (_.isUndefined(existingRelID)) {
      t.create('edge', 'HasCPV')
        .from(`$${tenderName}`)
        .to(((existingCPVID || {}).rid) || `$${cpvName}`)
        .set(cpvExtractor.extractHasCPV(rawCPV));
    } else {
      t.update('edge', 'HasCPV')
        .set(cpvExtractor.extractHasCPV(rawCPV))
        .where({ '@rid': existingRelID })
        .return('AFTER');
    }
  });
  return cpvName;
}

async function writeTender(rawTender) {
  const awardedLots = (rawTender.lots || []).filter((lot) =>
    (lot.bids || []).filter((bid) => bid.isWinning === true).length >= 1);
  if (_.isEmpty(awardedLots)) {
    return;
  }

  const tender = tenderExtractor.extractTender(rawTender);
  const tenderName = recordName(rawTender.id, 'Tender');

  const existingTender = await config.db.select().from('Tender')
    .where({ id: tender.id }).one();
  let transaction = config.db.let(tenderName, (t) => {
    if (_.isUndefined(existingTender)) {
      t.create('vertex', 'Tender')
        .set(tender);
    } else {
      t.update('Tender')
        .set(tender)
        .where({ id: tender.id })
        .return('AFTER');
    }
  });

  const buyerNames = await Promise.map(rawTender.buyers.filter((buyer) => buyer.id), (rawBuyer) =>
    upsertBuyer(transaction, rawBuyer, rawTender, tenderName));

  // If the tender exists we have to delete and rewrite its lots
  // We can't update each of the lots because they can't be uniquely identified from the data
  if (_.isUndefined(existingTender) === false) {
    const existingLotRel = await config.db.select("out('Comprises')").from('Tender')
      .where({ id: tender.id }).one();
    const existingLotIDs = existingLotRel.out;
    await Promise.map(existingLotIDs, (existingLotID) =>
      deleteLot(transaction, existingLotID.toString()));
  }

  await Promise.map(awardedLots, (rawLot) =>
    createLot(transaction, rawLot, rawTender, tenderName, buyerNames));

  await Promise.map(rawTender.cpvs, (rawCPV) =>
    upsertCPV(transaction, rawCPV, rawTender, tenderName));

  transaction.commit(5).return(`$${tenderName}`).one()
    .then((result) => result)
    .catch((err) => {
      console.log(transaction._state.let);
      console.error(err.message);
    });
}

function importFileData(filePath) {
  const instream = fs.createReadStream(filePath);
  const handler = readline.createInterface({ input: instream });

  handler.on('line', (line) => {
    writeTender(JSON.parse(line));
  });

  handler.on('close', () => {
    console.log('Done processing the file', filePath);
  });
}

function importDumpFiles() {
  const dumpFilePaths = process.argv.slice(2);

  dumpFilePaths.forEach((filePath) => importFileData(filePath));
}

importDumpFiles();

// For testing
module.exports = {
  writeTender,
};

'use strict';

const _ = require('lodash');
const fs = require('fs');
const Promise = require('bluebird');
const readline = require('readline');
const config = require('./../config');
const tenderExtractor = require('./../extractors/tender');
const buyerExtractor = require('./../extractors/buyer');

function recordName(uuid, className) {
  return `${className.toLowerCase()}${uuid.replace(/-/g, '')}`;
}

async function upsertBuyer(transaction, rawBuyer, rawTender) {
  const buyer = buyerExtractor.extractBuyer(rawBuyer);
  const buyerName = recordName(rawBuyer.id, 'Buyer');
  const tenderName = recordName(rawTender.id, 'Tender');
  const createsName = `${buyerName}creates${tenderName}`;
  const fromName = `$${buyerName}`;
  const toName = `$${tenderName}`;

  // TODO: Sometimes this returns undefined even though the buyer exists
  const existingBuyer = await config.db.select().from('Buyer').where({ id: rawBuyer.id }).one();
  if (_.isUndefined(existingBuyer)) {
    transaction.let(buyerName, (t) => {
      t.create('vertex', 'Buyer')
        .set(buyer);
    }).let(createsName, (t) => {
      t.create('edge', 'Creates')
        .from(fromName)
        .to(toName)
        .set(buyerExtractor.extractCreates(rawBuyer, rawTender));
    });
  } else {
    transaction.let(buyerName, (t) => {
      t.update('Buyer')
        .set(buyer)
        .where({ id: buyer.id })
        .return('AFTER');
    });
  }
  return transaction;
}

async function writeTender(rawTender) {
  const tender = tenderExtractor.extractTender(rawTender);
  const tenderName = recordName(rawTender.id, 'Tender');

  const existingTender = await config.db.select().from('Tender').where({ id: tender.id }).one();
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
  // TODO: Remove this filter by id after empty objects are excluded from the dumps
  await Promise.map(rawTender.buyers.filter((buyer) => buyer.id), (rawBuyer) =>
    upsertBuyer(transaction, rawBuyer, rawTender));

  const returnName = `$${tenderName}`;
  transaction.commit(5).return(returnName).one()
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
    const tenderAttrs = JSON.parse(line);
    const awardedLots = (tenderAttrs.lots || []).filter((lot) =>
      (lot.bids || []).filter((bid) => bid.isWinning === true).length >= 1);
    if (_.isEmpty(awardedLots)) {
      return;
    }
    writeTender(tenderAttrs);
  });

  handler.on('close', () => {
  });
}

function importDumpFiles() {
  const dumpFilePaths = process.argv.slice(2);

  dumpFilePaths.forEach((filePath) => importFileData(filePath));
}

importDumpFiles();

// For testing
module.exports = {
  upsertBuyer,
};

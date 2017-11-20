'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const config = require('./../config');
const tenderExtractor = require('./../extractors/tender');
const buyerExtractor = require('./../extractors/buyer');
function recordName(id, className) {
  return `${className.toLowerCase()}${id.replace(/-/g, '')}`;
}

// Returns true
// Raises OrientDBError if the writing failed
async function writeTender(rawTender) {
  const tender = tenderExtractor.extractTender(rawTender);
  const tenderName = recordName(rawTender.id, 'Tender');

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
        .where({ id: tender.id })
        .return('AFTER');
    }
  });

  // TODO: Remove this filter after empty objects in Digiwhist dump are fixed
  const buyerNames = await Promise.map(_.filter(rawTender.buyers, (buyer) => buyer.id),
    (rawBuyer) => upsertBuyer(transaction, rawBuyer, existingTenderID, tenderName));

  transaction.commit(5).return(`$${tenderName}`).one()
    .then((result) => result)
    .catch((err) => {
      console.log(transaction._state.let);
      console.error(err.message);
      throw err;
    });
  return true;
}

async function upsertBuyer(transaction, rawBuyer, existingTenderID, tenderName) {
  const buyer = buyerExtractor.extractBuyer(rawBuyer);
  const buyerName = recordName(rawBuyer.id, 'Buyer');

  const existingBuyer = await config.db.select().from('Buyer')
    .where({ id: rawBuyer.id }).one();
  if (_.isUndefined(existingBuyer)) {
    transaction.let(buyerName, (t) => {
      t.create('vertex', 'Buyer')
        .set(buyer);
    });
  } else {
    transaction.let(buyerName, (t) => {
      t.update('Buyer')
        .set(buyer)
        .where({ id: rawBuyer.id })
        .return('AFTER');
    });
  }

  const existingRelID = await config.db.select('@rid').from('Creates')
    .where({
      in: existingTenderID,
      out: (existingBuyer || {})['@rid'],
    }).one();
  transaction.let(`${buyerName}creates${tenderName}`, (t) => {
    if (_.isUndefined(existingRelID)) {
      t.create('edge', 'Creates')
        .from(`$${buyerName}`)
        .to(`$${tenderName}`)
        .set(buyerExtractor.extractCreates(rawBuyer));
    } else {
      t.update('edge', 'Creates')
        .set(buyerExtractor.extractCreates(rawBuyer))
        .where({ '@rid': existingRelID })
        .return('AFTER');
    }
  });
  return buyerName;
}

module.exports = {
  writeTender,
  upsertBuyer,
};

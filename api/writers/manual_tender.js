'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');
const uuidv4 = require('uuid/v4');

const config = require('../../config/default');
const tenderExtractor = require('./../../extractors/manual/tender');
const buyerExtractor = require('./../../extractors/manual/buyer');
const lotExtractor = require('./../../extractors/manual/lot');
const bidExtractor = require('./../../extractors/manual/bid');
const bidderExtractor = require('./../../extractors/manual/bidder');
const cpvExtractor = require('./../../extractors/manual/cpv');

function recordName(id, className) {
  return `${className.toLowerCase()}${id.replace(/-/g, '')}`;
}

// Returns true
// Raises OrientDBError if the writing failed
async function writeTender(fullTenderRecord) {
  const tender = tenderExtractor.extractTender(fullTenderRecord);
  const tenderName = recordName(tender.id, 'Tender');

  const transaction = config.db.let(tenderName, (t) => {
      t.create('vertex', 'Tender')
        .set(tender);
  });

  const processedCpv = await upsertCpv(transaction, fullTenderRecord, tenderName);

  // TODO: Remove this filter by id after empty objects are excluded from the Digiwhist dumps
  const buyerName = await upsertBuyer(transaction, fullTenderRecord, tenderName); // eslint-disable-line max-len;

  const lotName = await createLot(transaction, fullTenderRecord, tenderName);
  const bidName = await createBid(transaction, lotName, buyerName, processedCpv, fullTenderRecord);
  await upsertBidder(transaction, fullTenderRecord, bidName);

  return transaction.commit(2).return(`$${tenderName}`).one()
    .catch((err) => {
      console.log(err);
      throw err;
    });
}

async function createLot(transaction, fullTenderRecord, tenderName) {
  const lot = lotExtractor.extractLot(fullTenderRecord);
  const lotName = recordName(uuidv4(), 'Lot');

  transaction.let(lotName, (t) => {
    t.create('vertex', 'Lot')
      .set(lot);
  }).let(`${tenderName}comprises${lotName}`, (t) => {
    t.create('edge', 'Comprises')
      .from(`$${tenderName}`)
      .to(`$${lotName}`);
  });

  return lotName;
}

async function createBid(transaction, lotName, buyerName, cpvName, fullTenderRecord) { // eslint-disable-line max-len
  const bid = bidExtractor.extractBid(fullTenderRecord);
  const bidName = recordName(uuidv4(), 'Bid');

  transaction.let(bidName, (t) => {
    t.create('vertex', 'Bid')
      .set(bid);
  }).let(`${bidName}appliedTo${lotName}`, (t) => {
    t.create('edge', 'AppliedTo')
      .from(`$${bidName}`)
      .to(`$${lotName}`);
  });

  transaction.let(`${buyerName}awards${bidName}`, (t) => {
    t.create('edge', 'Awards')
      .from(`$${buyerName}`)
      .to(`$${bidName}`);
  });

  if (!_.isUndefined(cpvName)) {
    transaction.let(`${bidName}hasCPV${cpvName}`, (t) => {
      t.create('edge', 'BidHasCPV')
        .from(`$${bidName}`)
        .to(`$${cpvName}`);
    });
  }
  return bidName;
}

async function upsertBuyer(transaction, fullTenderRecord, tenderName) {
  const buyer = buyerExtractor.extractBuyer(fullTenderRecord);
  const existingBuyer = await config.db.select().from('Buyer')
    .where({ normalizedName: buyer.normalizedName }).one();
  const buyerName = recordName(buyer.id, 'Buyer');

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

  transaction.let(`${buyerName}creates${tenderName}`, (t) => {
    t.create('edge', 'Creates')
      .from(`$${buyerName}`)
      .to(`$${tenderName}`)
      .set(buyerExtractor.extractCreates());
  })
  return buyerName;
}

async function upsertBidder(transaction, fullTenderRecord, bidName) {
  const bidder = bidderExtractor.extractBidder(fullTenderRecord);
  const bidderName = recordName(bidder.id, 'Bidder');

  const existingBidder = await config.db.select().from('Bidder')
    .where({ normalizedName: bidder.normalizedName }).one();

  if (_.isUndefined(existingBidder)) {
    // See issue #35
    const transactedRecords = _.flatMap(transaction._state.bcommon, (arr) => arr[0]);
    if (_.includes(transactedRecords, bidderName) === false) {
      transaction.let(bidderName, (t) => {
        t.create('vertex', 'Bidder')
          .set(bidder);
      });
    }
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
      .set(bidderExtractor.extractParticipates());
  });
  return bidderName;
}

async function upsertCpv(transaction, fullTenderRecord, tenderName) {
  const cpv = cpvExtractor.extractCpv(fullTenderRecord);
  if (_.isUndefined(cpv.xOriginalCode) === false) {
    const cpvName = recordName(cpv.xOriginalCode, 'CPV');

    const existingCpv = await config.db.select().from('CPV')
      .where({ xOriginalCode: cpv.xOriginalCode }).one();
    const existingCpvID = (existingCpv || {})['@rid'];
    const processedCpvs = _.map(transaction._state.bcommon, (arr) => arr[0])
    if (_.includes(processedCpvs, cpvName) === false) {
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
    }

    const edgeName = `${tenderName}has${cpvName}`;
    if (_.includes(_.flatMap(transaction._state.bcommon, (arr) => arr[0]), edgeName) === false) {
      transaction.let(edgeName, (t) => {
        t.create('edge', 'HasCPV')
          .from(`$${tenderName}`)
          .to(`$${cpvName}`)
          .set(cpvExtractor.extractHasCpv());
      });
    }
    return cpvName;
  }
  return undefined;
}

module.exports = {
  writeTender,
  upsertBuyer,
  upsertBidder,
  upsertCpv,
  createLot,
  createBid,
};

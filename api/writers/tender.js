'use strict';

const _ = require('lodash');
const { URL } = require('url');
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
async function writeTender(fullTenderRecord, skipMilitaryFilters = false) {
  const awardedLots = _.filter(fullTenderRecord.lots, { status: 'AWARDED' });

  // If there are no awarded lots don't even process the tender
  if (awardedLots.length === 0) {
    return new Promise((resolve) => resolve(null));
  }

  const tender = tenderExtractor.extractTender(
    _.omit(fullTenderRecord, ['indicators', 'publications']),
    fullTenderRecord.indicators,
    fullTenderRecord.publications,
  );
  const tenderName = recordName(tender.id, 'Tender');

  // If the tender doesn't have at least one military CPV
  // and it's also not part of Directive 2009/81/EC skip it
  if (skipMilitaryFilters === false) {
    tender.xIsDirective = await isUnderDirective(fullTenderRecord.publications);
    const militaryCpv = await hasMilitaryCpv(fullTenderRecord.cpvs);
    if (militaryCpv === false && tender.xIsDirective === false) {
      return new Promise((resolve) => resolve(null));
    }
  }

  // Otherwise it can be considered a military tender and we should process it
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

  const processedCpvs = await Promise.map((fullTenderRecord.cpvs || []), (rawCpv) =>
    upsertCpv(transaction, rawCpv, existingTenderID, tenderName));
  // Only process further valid cpvs
  const cpvNames = _.compact(processedCpvs);

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

  await Promise.map((awardedLots || []), (rawLot) => {
    const rawBids = (rawLot.bids || []);
    return createLot(transaction, rawLot, tenderName, fullTenderRecord)
      .then((lotName) =>
        Promise.map(rawBids, (rawBid) =>
          createBid(transaction, rawBid, lotName, buyerNames, cpvNames, fullTenderRecord, rawLot)));
  });

  return transaction.commit(2).return(`$${tenderName}`).one()
    .catch((err) => {
      console.log(err);
      throw err;
    });
}

async function deleteLot(transaction, lotRID) {
  const lotName = `delete${recordName(uuidv4(), 'Lot')}`;

  transaction.let(lotName, (t) =>
    t.delete('vertex', 'Lot')
      .where({ '@rid': lotRID }));

  const existingBidRel = await config.db.select("in('AppliedTo')").from('Lot')
    .where({ '@rid': lotRID }).one();
  const existingBidRIDs = _.get(existingBidRel, 'in', []);
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

async function createLot(transaction, rawLot, tenderName, rawTender) {
  const lot = lotExtractor.extractLot(rawLot, rawTender);
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

async function createBid(transaction, rawBid, lotName, buyerNames, cpvNames, rawTender, rawLot) { // eslint-disable-line max-len
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

  await Promise.map(_.flatten([cpvNames]), (cpvName) =>
    transaction.let(`${bidName}hasCPV${cpvName}`, (t) => {
      t.create('edge', 'BidHasCPV')
        .from(`$${bidName}`)
        .to(`$${cpvName}`);
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
  const buyerName = recordName(_.last(_.split(rawBuyer.id, '::')), 'Buyer');

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
  const bidderName = recordName(_.last(_.split(rawBidder.id, '::')), 'Bidder');

  const existingBidder = await config.db.select().from('Bidder')
    .where({ id: bidder.id }).one();
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
      .set(bidderExtractor.extractParticipates(rawBidder));
  });
  return bidderName;
}

async function upsertCpv(transaction, rawCpv, existingTenderID, tenderName) {
  const cpv = cpvExtractor.extractCpv(rawCpv);
  if (_.isUndefined(cpv.xOriginalCode) === false) {
    const cpvName = recordName(cpv.xOriginalCode, 'CPV');

    const existingCpv = await config.db.select().from('CPV')
      .where({ xOriginalCode: cpv.xOriginalCode }).one();
    const existingCpvID = (existingCpv || {})['@rid'];
    if (_.includes(_.flatMap(transaction._state.bcommon, (arr) => arr[0]), cpvName) === false) {
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

    const existingRel = await config.db.select().from('HasCPV')
      .where({
        // This is needed because undefined confuses OrientDB
        in: (existingCpvID || null),
        out: (existingTenderID || null),
      }).one();
    const edgeName = `${tenderName}has${cpvName}`;
    if (_.includes(_.map(transaction._state.bcommon, (arr) => arr[0]), edgeName) === false) {
      if (_.isUndefined(existingRel)) {
        transaction.let(edgeName, (t) => {
          t.create('edge', 'HasCPV')
            .from(`$${tenderName}`)
            .to(`$${cpvName}`)
            .set(cpvExtractor.extractHasCpv(rawCpv));
        });
      } else {
        transaction.let(edgeName, (t) => {
          t.update('HasCPV')
            .set(cpvExtractor.extractHasCpv(rawCpv))
            .where({ '@rid': existingRel['@rid'] })
            .return('AFTER');
        });
      }
    }
    return cpvName;
  }
  return undefined;
}

async function hasMilitaryCpv(cpvs) {
  const extractedCpvs = _.map(cpvs, (rawCpv) =>
    cpvExtractor.extractCpv(rawCpv));
  const extractedCodes = _.map(extractedCpvs, 'code');
  const fetchedCpvs = await config.db.select().from('CPV')
    .where(`code IN [${extractedCodes.map((code) => `'${code}'`)}]`)
    .all();
  const militaryCpvs = _.filter(fetchedCpvs, { military: true });
  return !_.isEmpty(militaryCpvs);
}

async function isUnderDirective(publications) {
  const tedPublicationUrls = _
    .chain(publications)
    .filter({ source: 'http://ted.europa.eu' })
    .map('humanReadableUrl')
    .compact()
    .value();
  const formattedPublicationUrls = _.map(tedPublicationUrls, (publicationUrl) => {
    const publiUrl = new URL(publicationUrl);
    return `${publiUrl.host}${publiUrl.pathname}${publiUrl.search}`;
  });
  const directivePublications = await config.db.select().from('DirectiveCAN')
    .where(`sourceUrl in [${formattedPublicationUrls.map((url) => `'${url}'`)}]`)
    .all();
  return !_.isEmpty(directivePublications);
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
  hasMilitaryCpv,
  isUnderDirective,
};

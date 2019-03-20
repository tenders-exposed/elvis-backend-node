'use strict';

const uuidv4 = require('uuid/v4');
const FactoryGirl = require('factory-girl');
const tenderExtractor = require('./../extractors/tender');
const buyerExtractor = require('./../extractors/buyer');
const lotExtractor = require('./../extractors/lot');
const cpvExtractor = require('./../extractors/cpv');
const bidExtractor = require('./../extractors/bid');
const bidderExtractor = require('./../extractors/bidder');
const indicatorExtractor = require('./../extractors/indicator');

const factory = FactoryGirl.factory;
factory.setAdapter(new FactoryGirl.ObjectAdapter());

const tenderAttrs = {
  id: () => uuidv4(),
  modified: '2017-06-08T11:55:43.525',
  country: 'NL',
  finalPrice: {
    currency: 'EUR',
    netAmount: 1212121212,
  },
};
factory.define('rawTender', Object, tenderAttrs);
factory.define('extractedTender', Object, tenderAttrs, {
  afterBuild: (rawTender) => tenderExtractor.extractTender(rawTender),
});

const cpvAttrs = {
  code: factory.sequence((n) => `12021220${n}`),
  name: 'Talkative ghosts',
  xNumberDigits: 3,
  military: true,
};
factory.define('rawCpv', Object, cpvAttrs);
factory.define('extractedCpv', Object, cpvAttrs, {
  afterBuild: (rawCpv) => cpvExtractor.extractCpv(rawCpv),
});

const buyerAttrs = {
  id: () => uuidv4(),
  modified: '2017-06-08T11:55:43.525',
  name: 'Ministry of Magic',
  isPublic: true,
  address: {
    country: 'DK',
  },
};
factory.define('rawBuyer', Object, buyerAttrs);
factory.define('extractedBuyer', Object, buyerAttrs, {
  afterBuild: (rawBuyer) => buyerExtractor.extractBuyer(rawBuyer),
});

const lotAttrs = {
  lotNumber: factory.sequence((n) => n),
  awardDecisionDate: '2015-03-19',
  awardCriteria: [
    {
      name: 'Does it sparkle',
      weight: 10,
    },
  ],
  status: 'AWARDED',
  addressOfImplementation: {
    rawAddress: 'Klausenburger',
  },
  bidsCount: 0,
};
factory.define('rawLot', Object, lotAttrs);
factory.define('extractedLot', Object, lotAttrs, {
  afterBuild: (rawLot) => lotExtractor.extractLot(rawLot),
});

const bidAttrs = {
  isWinning: true,
  price: {
    currency: 'EUR',
    netAmount: 100011001.00,
  },
};
factory.define('rawBid', Object, bidAttrs);
factory.define('extractedBid', Object, bidAttrs, {
  afterBuild: async (rawBid) => {
    const rawTenderAttrs = await factory.build('rawTender');
    const rawLotAttrs = await factory.build('rawLot');
    return bidExtractor.extractBid(rawBid, rawTenderAttrs, rawLotAttrs);
  },
});

const bidderAttrs = {
  id: () => uuidv4(),
  modified: '2017-11-11T11:55:43.525',
  name: 'Ollivander\'s',
  isPublic: false,
  address: {
    country: 'DK',
  },
};
factory.define('rawBidder', Object, bidderAttrs);
factory.define('extractedBidder', Object, bidderAttrs, {
  afterBuild: (rawBidder) => bidderExtractor.extractBidder(rawBidder),
});

const indicatorAttrs = {
  id: () => uuidv4(),
  modified: '2017-11-11T11:55:43.525',
  type: 'Thunder scar on forehead',
  value: 1,
  relatedEntityId: 'Harrry',
};
factory.define('rawIndicator', Object, indicatorAttrs);
factory.define('extractedIndicator', Object, indicatorAttrs, {
  afterBuild: (indicator) => indicatorExtractor.extractIndicator(indicator),
});

factory.extend('rawBid', 'rawBidWithBidder', {
  bidders: factory.assocAttrsMany('rawBidder', 1),
});

factory.extend('rawLot', 'rawLotWithBid', {
  bids: factory.assocAttrsMany('rawBidWithBidder', 1),
});

factory.extend('rawTender', 'rawFullTender', {
  lots: factory.assocAttrsMany('rawLotWithBid', 1),
  buyers: factory.assocAttrsMany('rawBuyer', 1),
  cpvs: factory.assocAttrsMany('rawCpv', 1),
});

factory.define('rawContractNotice', Object, {
  publicationDate: '2017-09-15',
  sourceId: '2015/S 006-hocuspocus',
  formType: 'CONTRACT_NOTICE',
});

factory.define('rawContractAwardNotice', Object, {
  publicationDate: '2017-09-15',
  sourceId: '2015/S 006-preparatus',
  formType: 'CONTRACT_AWARD',
});

module.exports = factory;

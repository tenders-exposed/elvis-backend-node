'use strict';

const FactoryGirl = require('factory-girl');
const uuidv4 = require('uuid/v4');
const tenderExtractor = require('./../extractors/tender');

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
  afterBuild: (rawTender) => {
    return tenderExtractor.extractTender(rawTender);
  },
});

const buyerAttrs = {
  id: () => uuidv4(),
  modified: '2017-06-08T11:55:43.525',
  name: 'Ministry of Magic',
};

factory.define('rawBuyer', Object, buyerAttrs);

factory.define('rawLot', Object, {
  lotNumber: factory.sequence((n) => n),
  awardDecisionDate: '2015-03-19',
  awardCriteria: [
    {
      name: 'Sanest',
      weight: 10,
    },
  ],
  status: 'awarded',
  addressOfImplementation: {
    rawAddress: 'Klausenburger',
  },
});

factory.define('rawBid', Object, {});

factory.define('rawFullTender', Object, Object.assign(tenderAttrs, {
  buyers: factory.assocAttrsMany('rawBuyer', 2),
}));

module.exports = factory;


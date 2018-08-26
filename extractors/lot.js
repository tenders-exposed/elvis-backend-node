'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const priceExtractor = require('./price');

function extractLot(lotAttrs, tenderAttrs) {
  if (_.isUndefined(lotAttrs.id) === false) {
    console.log('Bid with id found', lotAttrs); // eslint-disable-line no-console
  }
  const bids = (lotAttrs.bids || []);
  return {
    id: uuidv4(),
    title: lotAttrs.title,
    description: lotAttrs.description,
    contractNumber: lotAttrs.contractNumber,
    lotNumber: lotAttrs.lotNumber,
    bidsCount: lotAttrs.bidsCount || bids.length,
    validBidsCount: lotAttrs.validBidsCount,
    awardDecisionDate: lotAttrs.awardDecisionDate,
    awardCriteria: lotAttrs.awardCriteria || tenderAttrs.awardCriteria,
    selectionMethod: lotAttrs.selectionMethod,
    addressOfImplementation: lotAttrs.addressOfImplementation,
    status: lotAttrs.status,
    estimatedPrice: priceExtractor.extractPrice(lotAttrs.estimatedPrice),
  };
}

module.exports = {
  extractLot,
};

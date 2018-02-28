'use strict';

const priceExtractor = require('./price');

function extractLot(lotAttrs) {
  return {
    title: lotAttrs.title,
    description: lotAttrs.description,
    contractNumber: lotAttrs.contractNumber,
    lotNumber: lotAttrs.lotNumber,
    bidsCount: lotAttrs.bidsCount,
    validBidsCount: lotAttrs.validBidsCount,
    awardDecisionDate: lotAttrs.awardDecisionDate,
    awardCriteria: lotAttrs.awardCriteria,
    selectionMethod: lotAttrs.selectionMethod,
    addressOfImplementation: lotAttrs.addressOfImplementation,
    status: lotAttrs.status,
    estimatedPrice: priceExtractor.extractPrice(lotAttrs.estimatedPrice),
  };
}

module.exports = {
  extractLot,
};

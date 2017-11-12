'use strict';

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
    addressOfImplementation: lotAttrs.addressOfImplementation,
    status: lotAttrs.status,
    estimatedPrice: lotAttrs.estimatedPrice,
  };
}

module.exports = {
  extractLot,
};

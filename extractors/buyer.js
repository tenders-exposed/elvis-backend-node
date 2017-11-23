'use strict';

const helpers = require('./helpers');
const indicatorExtractor = require('./indicator')

function extractBuyer(buyerAttrs) {
  return {
    id: buyerAttrs.id,
    name: buyerAttrs.name,
    address: buyerAttrs.address,
    isPublic: buyerAttrs.isPublic,
    buyerType: buyerAttrs.buyerType,
    isSubsidized: buyerAttrs.isSubsidized,
    xDigiwhistLastModified: helpers.formatTimestamp(buyerAttrs.modified),
    indicators: (buyerAttrs.indicators || []).map((indicatorAttrs) =>
      indicatorExtractor.extractIndicator(indicatorAttrs)),
  };
}

function extractCreates(buyerAttrs) {
  return {
    isLeader: buyerAttrs.isLeader || false,
  };
}

module.exports = {
  extractBuyer,
  extractCreates,
};

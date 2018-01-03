'use strict';

const _ = require('lodash');
const helpers = require('./helpers');
const indicatorExtractor = require('./indicator');

function extractBuyer(buyerAttrs, tenderAttrs = {}) {
  return {
    id: buyerAttrs.id,
    name: buyerAttrs.name,
    address: buyerAttrs.address,
    isPublic: buyerAttrs.isPublic,
    buyerType: buyerAttrs.buyerType,
    isSubsidized: buyerAttrs.isSubsidized,
    xDigiwhistLastModified: helpers.formatTimestamp(buyerAttrs.modified),
    indicators: _
      .filter((tenderAttrs.indicators || []), { relatedEntityId: buyerAttrs.id })
      .map((indicatorAttrs) => indicatorExtractor.extractIndicator(indicatorAttrs)),
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

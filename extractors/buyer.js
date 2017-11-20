'use strict';

const _ = require('lodash');
const helpers = require('./helpers');

function extractBuyer(buyerAttrs) {
  return {
    id: buyerAttrs.id,
    name: buyerAttrs.name,
    address: buyerAttrs.address,
    isPublic: buyerAttrs.isPublic,
    buyerType: buyerAttrs.buyerType,
    isSubsidized: buyerAttrs.isSubsidized,
    xDigiwhistLastModified: helpers.formatTimestamp(buyerAttrs.modified),
  };
}

function extractCreates(buyerAttrs) {
  return {
    isLeader: buyerAttrs.isLeader,
  };
}

module.exports = {
  extractBuyer,
  extractCreates,
};

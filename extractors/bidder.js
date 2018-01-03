'use strict';


const _ = require('lodash');
const helpers = require('./helpers');
const indicatorExtractor = require('./indicator');

function extractBidder(bidderAttrs, tenderAttrs = {}) {
  return {
    id: bidderAttrs.id,
    name: bidderAttrs.name,
    address: bidderAttrs.address,
    isPublic: bidderAttrs.isPublic,
    xDigiwhistLastModified: helpers.formatTimestamp(bidderAttrs.modified),
    indicators: _
      .filter((tenderAttrs.indicators || []), { relatedEntityId: bidderAttrs.id })
      .map((indicatorAttrs) => indicatorExtractor.extractIndicator(indicatorAttrs)),
  };
}

function extractParticipates(bidderAttrs) {
  return {
    isLeader: bidderAttrs.isLeader || false,
  };
}

module.exports = {
  extractBidder,
  extractParticipates,
};

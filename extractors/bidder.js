'use strict';

const _ = require('lodash');
const helpers = require('./helpers');

function extractBidder(bidderAttrs) {
  return {
    id: bidderAttrs.id,
    name: bidderAttrs.name,
    address: bidderAttrs.address,
    isPublic: bidderAttrs.isPublic,
    xDigiwhistLastModified: helpers.formatTimestamp(bidderAttrs.modified),
  };
}

function extractParticipates(bidderAttrs, bidAttrs) {
  let isLeader = bidderAttrs.isLeader;
  if (_.isUndefined(isLeader) && bidAttrs.bidders.length === 1) {
    isLeader = true;
  }
  return {
    isLeader,
  };
}

module.exports = {
  extractBidder,
  extractParticipates,
};

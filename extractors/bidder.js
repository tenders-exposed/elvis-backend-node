'use strict';

const _ = require('lodash');
const moment = require('moment');


function extractBidder(bidderAttrs) {
  return {
    id: bidderAttrs.id,
    name: bidderAttrs.name,
    address: bidderAttrs.address,
    isPublic: bidderAttrs.isPublic,
    xDigiwhistLastModified: moment(bidderAttrs.modified).format('YYYY-MM-DD HH:mm:ss'),
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

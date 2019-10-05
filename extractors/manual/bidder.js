'use strict';


const _ = require('lodash');
const helpers = require('./helpers');
const uuidv4 = require('uuid/v4');

function extractBidder(tenderAttrs) {
  return {
    id: uuidv4(),
    name: _.trim(tenderAttrs.w_name),
    normalizedName: _.trim(helpers.removeDiacritics(tenderAttrs.w_name)),
  };
}

function extractParticipates() {
  return {
    isLeader: undefined,
  };
}

module.exports = {
  extractBidder,
  extractParticipates,
};

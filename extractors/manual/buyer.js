'use strict';

const _ = require('lodash');
const helpers = require('./helpers');
const uuidv4 = require('uuid/v4');

function extractBuyer(tenderAttrs) {
  return {
    id: uuidv4(),
    name: _.trim(tenderAttrs.buyer),
    normalizedName: _.trim(helpers.removeDiacritics(tenderAttrs.buyer)),
  };
}

function extractCreates() {
  return {
    isLeader: undefined,
  };
}

module.exports = {
  extractBuyer,
  extractCreates,
};

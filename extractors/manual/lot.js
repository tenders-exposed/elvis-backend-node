'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const priceExtractor = require('./price');

function extractLot(tenderAttrs) {
  return {
    id: uuidv4(),
    title: tenderAttrs.title,
  };
}

module.exports = {
  extractLot,
};

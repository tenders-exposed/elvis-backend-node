'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const helpers = require('./helpers');
const priceExtractor = require('./price');

function extractBid(tenderAttrs) {
  const valueAttrs = _.pick(tenderAttrs, ['currency', 'value_clean', 'value_eur', 'value_approx'])
  return {
    id: uuidv4(),
    isWinning: true,
    price: priceExtractor.extractPrice(valueAttrs),
    xCountry: tenderAttrs.country,
    xYear: helpers.parseNumber(tenderAttrs.year_clean),
    xYearApproximated: (tenderAttrs.year_approx === "1"),
  }
}

module.exports = {
  extractBid,
};

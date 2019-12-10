'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const helpers = require('./helpers');
const priceExtractor = require('./price');

function extractTender(tenderAttrs) {
  const valueAttrs = _.pick(tenderAttrs, ['currency', 'value_clean', 'value_eur', 'value_approx'])
  return {
    id: tenderAttrs.id,
    title: _.capitalize(tenderAttrs.subject),
    titleEnglish: _.capitalize(tenderAttrs.subject),
    country: tenderAttrs.country,
    finalPrice: priceExtractor.extractPrice(valueAttrs),
    year: helpers.parseNumber(tenderAttrs.year_clean),
    xYearApproximated: (tenderAttrs.year_approx === "1"),
    sources: tenderAttrs.source.split('\n'),
  };
}

module.exports = {
  extractTender,
};

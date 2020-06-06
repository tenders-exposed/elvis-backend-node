'use strict';

const _ = require('lodash');
const moment = require('moment');
const uuidv4 = require('uuid/v4');
const priceExtractor = require('./price');
const tenderExtractor = require('./tender');

function extractBid(bidAttrs, tenderAttrs) {
  if (_.isUndefined(bidAttrs.id) === false) {
    console.log('Bid with id found', bidAttrs); // eslint-disable-line no-console
  }
  return {
    id: uuidv4(),
    isWinning: bidAttrs.isWinning,
    isSubcontracted: bidAttrs.isSubcontracted,
    isConsortium: bidAttrs.isConsortium,
    isDisqualified: bidAttrs.isDisqualified,
    price: priceExtractor.extractPrice(bidAttrs.price),
    robustPrice: priceExtractor.extractPrice(bidAttrs.robustPrice),
    xCountry: _.get(tenderAttrs, 'ot.country') || tenderAttrs.country,
    xYear: tenderExtractor.extractYear(
      tenderAttrs,
      (tenderAttrs.publications || [])
    ),
    sources: [extractSource(tenderAttrs)],
  };
}

function extractSource(tenderAttrs) {
  const fomattedCountry = _.lowerCase(tenderAttrs.country);
  const opentenderLink = `https://opentender.eu/${fomattedCountry}/tender/${tenderAttrs.id}`;
  return opentenderLink;
}

module.exports = {
  extractBid,
};

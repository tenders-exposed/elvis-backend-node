'use strict';

const _ = require('lodash');
const moment = require('moment');
const uuidv4 = require('uuid/v4');
const priceExtractor = require('./price');

function extractBid(bidAttrs, tenderAttrs, lotAttrs) {
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
    xCountry: tenderAttrs.country,
    xYear: extractYear(lotAttrs.awardDecisionDate),
    xTEDCANID: _
      .chain((tenderAttrs.publications || []))
      .filter({ formType: 'CONTRACT_AWARD' })
      .head()
      .get('sourceId')
      .value(),
  };
}

function extractYear(awardDecisionDate) {
  let year;
  if (_.isNil(awardDecisionDate) === false) {
    year = moment(awardDecisionDate).year();
  }
  return year;
}

module.exports = {
  extractBid,
};

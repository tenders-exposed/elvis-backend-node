'use strict';

const _ = require('lodash');
const priceExtractor = require('./price');

function extractBid(bidAttrs, publications = []) {
  return {
    isWinning: bidAttrs.isWinning,
    isSubcontracted: bidAttrs.isSubcontracted,
    isConsortium: bidAttrs.isConsortium,
    isDisqualified: bidAttrs.isDisqualified,
    price: priceExtractor.extractPrice(bidAttrs.price),
    robustPrice: priceExtractor.extractPrice(bidAttrs.robustPrice),
    xTEDCANID: _
      .chain(publications)
      .filter({ formType: 'CONTRACT_AWARD' })
      .head()
      .get('sourceId')
      .value(),
  };
}

module.exports = {
  extractBid,
};

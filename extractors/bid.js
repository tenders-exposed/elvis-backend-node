'use strict';

function extractBid(bidAttrs) {
  return {
    isWinning: bidAttrs.isWinning,
    isSubcontracted: bidAttrs.isSubcontracted,
    isConsortium: bidAttrs.isConsortium,
    isDisqualified: bidAttrs.isDisqualified,
    price: bidAttrs.price,
    robustPrice: bidAttrs.robustPrice,
  };
}

module.exports = {
  extractBid,
};

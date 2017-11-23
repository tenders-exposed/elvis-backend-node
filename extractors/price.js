'use strict';

const _ = require('lodash');

function extractPrice(priceAttrs) {
  if (_.isUndefined(priceAttrs) || _.isEmpty(priceAttrs)) {
    return undefined;
  }
  return {
    amountWithVat: priceAttrs.amountWithVat,
    currency: priceAttrs.currency,
    netAmount: priceAttrs.netAmount,
    netAmountEur: priceAttrs.netAmountEur,
    publicationDate: priceAttrs.publicationDate,
    vat: priceAttrs.vat,
  };
}

module.exports = {
  extractPrice,
};

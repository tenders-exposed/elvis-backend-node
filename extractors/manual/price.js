'use strict';

const _ = require('lodash');
const helpers = require('./helpers');

function extractPrice(priceAttrs) {
  if (_.isUndefined(priceAttrs) || _.isEmpty(priceAttrs)) {
    return undefined;
  }
  return {
    currency: priceAttrs.currency,
    netAmount: helpers.parseNumber(_.replace(priceAttrs.value_clean, /,/g, '')),
    netAmountEur: helpers.parseNumber(_.replace(priceAttrs.value_eur, /,/g, '')),
    xAmountApproximated: (priceAttrs.value_approx === "1"),
  };
}



module.exports = {
  extractPrice,
};

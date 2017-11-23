'use strict';

const _ = require('lodash');
const helpers = require('./helpers');
const indicatorExtractor = require('./indicator');
const priceExtractor = require('./price');

function extractTender(tenderAttrs) {
  return {
    id: tenderAttrs.id,
    title: tenderAttrs.title,
    description: tenderAttrs.description,
    country: tenderAttrs.country,
    isFrameworkAgreement: tenderAttrs.isFrameworkAgreement,
    isCoveredByGpa: tenderAttrs.isCoveredByGpa,
    nationalProcedureType: tenderAttrs.nationalProcedureType,
    finalPrice: priceExtractor.extractPrice(tenderAttrs.finalPrice),
    isWholeTenderCancelled: tenderAttrs.isWholeTenderCancelled,
    xIsEuFunded: assertIsEuFunded(tenderAttrs),
    xDigiwhistLastModified: helpers.formatTimestamp(tenderAttrs.modified),
    indicators: (tenderAttrs.indicators || []).map((indicatorAttrs) =>
      indicatorExtractor.extractIndicator(indicatorAttrs)),
  };
}

function assertIsEuFunded(tenderAttrs) {
  let isEuFunded;
  const euFundings = _.compact((tenderAttrs.fundings || [])
    .map((funding) => funding.isEuFund));
  if (euFundings.length > 0) {
    isEuFunded = euFundings.includes(true);
  }
  return isEuFunded;
}

module.exports = {
  extractTender,
};

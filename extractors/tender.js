'use strict';

const _ = require('lodash');
const helpers = require('./helpers');
const priceExtractor = require('./price');
const indicatorExtractor = require('./indicator');

function extractTender(tenderAttrs, indicators = [], publications = []) {
  return {
    id: tenderAttrs.id,
    title: tenderAttrs.title,
    titleEnglish: tenderAttrs.titleEnglish,
    description: tenderAttrs.description,
    country: tenderAttrs.country,
    isFrameworkAgreement: tenderAttrs.isFrameworkAgreement,
    isCoveredByGpa: tenderAttrs.isCoveredByGpa,
    nationalProcedureType: tenderAttrs.nationalProcedureType,
    finalPrice: priceExtractor.extractPrice(tenderAttrs.finalPrice),
    isWholeTenderCancelled: tenderAttrs.isWholeTenderCancelled,
    xIsEuFunded: assertIsEuFunded(tenderAttrs),
    xDigiwhistLastModified: helpers.formatTimestamp(tenderAttrs.modified),
    indicators: _
      .filter(indicators, { relatedEntityId: tenderAttrs.id })
      .map((indicatorAttrs) => indicatorExtractor.extractIndicator(indicatorAttrs)),
    xTEDCNID: _.chain(publications)
      .filter({ formType: 'CONTRACT_NOTICE' })
      .head()
      .get('sourceId')
      .value(),
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

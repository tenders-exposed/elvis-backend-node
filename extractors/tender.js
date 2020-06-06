'use strict';

const _ = require('lodash');
const moment = require('moment');
const helpers = require('./helpers');
const priceExtractor = require('./price');
const indicatorExtractor = require('./indicator');

function extractTender(tenderAttrs, indicators = [], publications = []) {
  return {
    id: _.get(tenderAttrs, 'persistentId') || tenderAttrs.id,
    title: tenderAttrs.title,
    titleEnglish: tenderAttrs.titleEnglish,
    description: tenderAttrs.description,
    country: _.get(tenderAttrs, 'ot.country') || tenderAttrs.country,
    isFrameworkAgreement: tenderAttrs.isFrameworkAgreement,
    isCoveredByGpa: tenderAttrs.isCoveredByGpa,
    procedureType: tenderAttrs.procedureType,
    finalPrice: priceExtractor.extractPrice(tenderAttrs.finalPrice),
    isWholeTenderCancelled: tenderAttrs.isWholeTenderCancelled,
    xIsEuFunded: assertIsEuFunded(tenderAttrs),
    xDigiwhistLastModified: helpers.formatTimestamp(tenderAttrs.modified),
    indicators: _
      .filter(indicators, { relatedEntityId: tenderAttrs.id })
      .map((indicatorAttrs) => indicatorExtractor.extractIndicator(indicatorAttrs)),
    year: extractYear(tenderAttrs, publications),
    sources: [extractSource(tenderAttrs)],
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

function extractYear(tenderAttrs, publications) {
  const noticePubDate = _.get(
    _.head(_.filter(publications, { formType: 'CONTRACT_NOTICE' })),
    'publicationDate',
  );
  const awardPubDate = _.get(
    _.head(_.filter(publications, { formType: 'CONTRACT_AWARD' })),
    'publicationDate',
  );
  let year = moment(tenderAttrs.awardDecisionDate).year();
  if (_.isUndefined(year) === true) {
    year = moment(awardPubDate).year();
  }
  if (_.isUndefined(year) === true) {
    year = moment(noticePubDate).year();
  }
  return year;
}

function extractSource(tenderAttrs) {
  const fomattedCountry = _.lowerCase(tenderAttrs.country);
  const opentenderLink = `https://opentender.eu/${fomattedCountry}/tender/${tenderAttrs.id}`;
  return opentenderLink;
}

module.exports = {
  extractTender,
  extractYear
};

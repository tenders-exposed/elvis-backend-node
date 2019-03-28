'use strict';

const _ = require('lodash');
const moment = require('moment');
const helpers = require('./helpers');
const priceExtractor = require('./price');
const indicatorExtractor = require('./indicator');

function extractTender(tenderAttrs, indicators = [], publications = []) {
  return {
    id: tenderAttrs.id,
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
    xTEDCNID: _.get(
      _.head(_.filter(publications, { formType: 'CONTRACT_NOTICE' })),
      'sourceId',
    ),
    year: extractYear(publications),
    sources: extractSources(publications),
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

function extractYear(publications) {
  let year;
  const noticePubDate = _.get(
    _.head(_.filter(publications, { formType: 'CONTRACT_NOTICE' })),
    'publicationDate',
  );
  const awardPubDate = _.get(
    _.head(_.filter(publications, { formType: 'CONTRACT_AWARD' })),
    'publicationDate',
  );
  if (_.isUndefined(awardPubDate) === false) {
    year = moment(awardPubDate).year();
  }
  if (_.isUndefined(noticePubDate) === false) {
    year = moment(noticePubDate).year();
  }
  return year;
}

function extractSources(publications) {
  const contractNotices = _.filter(publications, { formType: 'CONTRACT_NOTICE' });
  const sourceURLs = _.map(contractNotices, 'humanReadableUrl');
  return sourceURLs;
}

module.exports = {
  extractTender,
};

/* eslint-disable func-names */

'use strict';

// This approach is needed to avoid circular dependecy errors
function tenderSerializer() {
}
module.exports = tenderSerializer;

const _ = require('lodash');
const Promise = require('bluebird');

const config = require('../../config/default');
const lotSerializer = require('./lot');
const actorSerializer = require('./actor');

tenderSerializer.formatTender = function (tender) {
  const formattedTender = _.pick(tender, ['id', 'title', 'titleEnglish', 'description',
    'isCoveredByGpa', 'isFrameworkAgreement', 'procedureType', 'year', 'country', 'isDirective']);
  formattedTender.isEUFunded = tender.xIsEuFunded;
  formattedTender.TEDCNID = tender.xTEDCNID;
  formattedTender.isDirective = tender.xIsDirective;
  formattedTender.finalValue = _.get(tender, 'finalPrice.netAmountEur') || undefined;
  return formattedTender;
};

tenderSerializer.formatTenderWithBuyers = function (network, tender) {
  const formattedTender = tenderSerializer.formatTender(tender);
  return config.db.select("expand(in('Creates'))")
    .from('Tender')
    .where({ id: tender.id })
    .all()
    .then((buyers) => Promise.map(buyers, (buyer) =>
      actorSerializer.formatActorWithNode(network, buyer)))
    .then((formattedBuyers) => {
      formattedTender.buyers = formattedBuyers;
      return formattedTender;
    });
};

tenderSerializer.formatTenderWithRelated = function (network, tender) {
  return tenderSerializer.formatTenderWithBuyers(network, tender)
    .then((formattedTender) =>
      config.db.select("expand(out('Comprises'))")
        .from('Tender')
        .where({ id: tender.id })
        .all()
        .then((lots) => Promise.map(lots, (lot) =>
          lotSerializer.formatLotWithBids(network, lot)))
        .then((formattedLots) => {
          formattedTender.lots = formattedLots;
          return formattedTender;
        }));
};

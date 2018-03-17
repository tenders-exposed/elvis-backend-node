/* eslint-disable func-names */

'use strict';

// This approach is needed to avoid circular dependecy errors
function lotSerializer() {
}
module.exports = lotSerializer;

const _ = require('lodash');
const Promise = require('bluebird');
const moment = require('moment');

const config = require('../../config/default');
const bidSerializer = require('./bid');
const tenderSerializer = require('./tender');

lotSerializer.formatLot = function (lot) {
  const formattedLot = _.pick(lot, ['title', 'description', 'bidsCount', 'selectionMethod']);
  formattedLot.awardDecisionDate = moment(lot.awardDecisionDate).format('YYYY-MM-DD');
  formattedLot.addressOfImplementation = _.pick(
    lot.addressOfImplementation,
    ['rawAddress', 'nuts', 'city', 'country', 'street'],
  );
  formattedLot.estimatedValue = _.get(lot, 'estimatedPrice.netAmountEur') || undefined;
  return formattedLot;
};

lotSerializer.formatLotWithTender = function (network, lot) {
  const formattedLot = lotSerializer.formatLot(lot);
  return config.db.select("expand(in('Comprises'))")
    .from('Lot')
    .where({ id: lot.id })
    .one()
    .then((tender) =>
      tenderSerializer.formatTenderWithBuyers(network, tender))
    .then((formattedTender) => {
      formattedLot.tender = formattedTender;
      return formattedLot;
    });
};

lotSerializer.formatLotWithBids = function (network, lot) {
  const formattedLot = lotSerializer.formatLot(lot);
  return config.db.select("expand(in('AppliedTo'))")
    .from('Lot')
    .where({ id: lot.id })
    .all()
    .then((bids) => Promise.map(bids, (bid) =>
      bidSerializer.formatBidWithBidders(network, bid)))
    .then((formattedBids) => {
      formattedLot.bids = formattedBids;
      return formattedLot;
    });
};

/* eslint-disable func-names */

'use strict';

// This approach is needed to avoid circular dependecy errors
function bidSerializer() {
}
module.exports = bidSerializer;

const _ = require('lodash');
const Promise = require('bluebird');

const config = require('../../config/default');
const actorSerializer = require('./actor');
const lotSerializer = require('./lot');

bidSerializer.formatBid = function (bid) {
  const formattedBid = _.pick(bid, ['isWinning', 'isSubcontracted']);
  formattedBid.xYearApproximated = _.get(bid, 'xYearApproximated', false)
  formattedBid.TEDCANID = bid.xTEDCANID;
  formattedBid.value = _.get(bid, 'price.netAmountEur') || undefined;
  formattedBid.xAmountApproximated = _.get(bid, 'price.xAmountApproximated', false);
  return formattedBid;
};

bidSerializer.formatBidWithBidders = function (network, bid) {
  const formattedBid = bidSerializer.formatBid(bid);
  return config.db.select("expand(in('Participates'))")
    .from('Bid')
    .where({ id: bid.id })
    .all()
    .then((bidders) => Promise.map(bidders, (bidder) =>
      actorSerializer.formatActorWithNode(network, bidder)))
    .then((formattedBidders) => {
      formattedBid.bidders = formattedBidders;
      return formattedBid;
    });
};

bidSerializer.formatBidWithRelated = function (network, bid) {
  const retrieveFormattedLot = config.db.select("expand(out('AppliedTo'))")
    .from('Bid')
    .where({ id: bid.id })
    .one()
    .then((lot) => lotSerializer.formatLotWithTender(network, lot));
  return Promise.join(
    bidSerializer.formatBidWithBidders(network, bid),
    retrieveFormattedLot,
    (formattedBid, formattedLotWithTender) => {
      formattedBid.lot = formattedLotWithTender;
      return formattedBid;
    },
  );
};

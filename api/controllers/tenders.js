'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const moment = require('moment');
const config = require('../../config/default');
const clusterWriters = require('../writers/actor_cluster');
const networkWriters = require('../writers/network');
const actorsController = require('../controllers/actors');
const codes = require('../helpers/codes');
const formatError = require('../helpers/errorFormatter');

function getNetworkTender(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const tenderID = req.swagger.params.tenderID.value;
  return clusterWriters.retrieveNetwork(networkID)
    .then((network) =>
      retrieveNetworkTender(network, tenderID)
        .then((tender) => formatTender(network, tender)))
    .then((tender) => res.status(codes.SUCCESS).json({
      tender,
    }))
    .catch((err) => formatError(err, req, res));
}

function formatTender(network, tender) {
  const formattedTender = _.pick(tender, ['id', 'title', 'titleEnglish', 'description',
    'isCoveredByGpa', 'isFrameworkAgreement', 'procedureType', 'year', 'country']);
  formattedTender.isEUFunded = tender.xIsEuFunded;
  formattedTender.TEDCNID = tender.xTEDCNID;
  formattedTender.finalValue = _.get(tender, 'finalPrice.netAmountEur') || undefined;
  const retrieveLots = config.db.select("expand(out('Comprises'))")
    .from('Tender')
    .where({ id: tender.id })
    .all()
    .then((lots) => Promise.map(lots, (lot) => formatLot(lot, network)));
  const retrieveBuyers = config.db.select("expand(in('Creates'))")
    .from('Tender')
    .where({ id: tender.id })
    .all()
    .then((buyers) => Promise.map(buyers, (buyer) => formatActor(buyer, network)));
  return Promise.join(
    retrieveLots,
    retrieveBuyers,
    (lots, buyers) => {
      formattedTender.lots = lots;
      formattedTender.buyers = buyers;
      return formattedTender;
    },
  );
}

function formatLot(lot, network) {
  const formattedLot = _.pick(lot, ['title', 'description', 'bidsCount', 'selectionMethod']);
  formattedLot.awardDecisionDate = moment(lot.awardDecisionDate).format('YYYY-MM-DD');
  formattedLot.addressOfImplementation = _.pick(
    lot.addressOfImplementation,
    ['rawAddress', 'nuts', 'city', 'country', 'street'],
  );
  formattedLot.estimatedValue = _.get(lot, 'estimatedPrice.netAmountEur') || undefined;
  return config.db.select("expand(in('AppliedTo'))")
    .from('Lot')
    .where({ '@rid': lot['@rid'] })
    .all()
    .then((bids) => Promise.map(bids, (bid) => formatBid(bid, network)))
    .then((formattedBids) => {
      formattedLot.bids = formattedBids;
      return formattedLot;
    });
}

function formatBid(bid, network) {
  const formattedBid = _.pick(bid, ['isWinning', 'isSubcontracted']);
  formattedBid.TEDCANID = bid.xTEDCANID;
  formattedBid.value = _.get(bid, 'price.netAmountEur') || undefined;
  return config.db.select("expand(in('Participates'))")
    .from('Bid')
    .where({ '@rid': bid['@rid'] })
    .all()
    .then((bidders) => Promise.map(bidders, (bidder) => formatActor(bidder, network)))
    .then((formattedBidders) => {
      formattedBid.bidders = formattedBidders;
      return formattedBid;
    });
}

function formatActor(actor, network) {
  return config.db.select("*, in('Includes').id as clusterIDs")
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      "in('ActingAs').id": actor.id,
    })
    .one()
    .then((networkActor) => {
      const formattedActor = actorsController.formatActor(actor);
      formattedActor.nodeID = networkActor.id;
      if (networkActor.active === false) {
        formattedActor.nodeID = networkActor.clusterIDs[0];
      }
      return formattedActor;
    });
}

function retrieveNetworkTender(network, tenderID) {
  return config.db.query(
    `SELECT *
      FROM Bid
      WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
      AND out('AppliedTo').in('Comprises').id=:tenderID
      AND isWinning=true;`,
    { params: Object.assign({}, network.query, { tenderID }) },
  ).then((bids) => {
    if (_.isEmpty(bids)) {
      throw codes.BadRequest(`Tender with \`id\` ${tenderID} has no bids that commply with the network query.`);
    }
    return config.db.select()
      .from('Tender')
      .where({ id: tenderID })
      .one()
      .then((tender) => {
        if (_.isUndefined(tender) === true) {
          throw codes.NotFound(`Tender with \`id\` ${tenderID} was not found.`);
        }
        return tender;
      });
  });
}

module.exports = {
  getNetworkTender,
  formatTender,
  formatLot,
  formatBid,
  formatActor,
  retrieveNetworkTender,
};

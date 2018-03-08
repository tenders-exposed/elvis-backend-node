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

function getNetworkActor(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const nodeID = req.swagger.params.nodeID.value;
  return Promise.join(
    clusterWriters.retrieveNetwork(networkID),
    config.db.select()
      .from('NetworkActor')
      .where({ id: nodeID })
      .one(),
    (network, networkActor) => formatNetworkActor(network, networkActor),
  )
    .then((networkActor) => res.status(codes.SUCCESS).json({
      node: networkActor,
    }))
    .catch((err) => formatError(err, req, res));
}

function formatNetworkActor(network, networkActor) {
  const edgeToBidClass = networkActor.type === 'buyer' ? 'Awards' : 'Participates';
  const node = _.pick(networkActor, ['label', 'id', 'type', 'medianCompetition', 'value']);
  node.flags = {};
  node.hidden = !networkActor.active;
  return config.db.select("expand(out('Includes'))")
    .from('NetworkActor')
    .where({ id: networkActor.id })
    .all()
    .then((nodes) => _.map(nodes, 'id'))
    .then((nodes) => {
      if (nodes.length) {
        node.nodes = nodes;
        return nodes;
      }
      return undefined;
    })
    .then((nodes) => {
      const networkActorIDs = nodes || [node.id];
      const actorIDsQuery = `SELECT expand(in('ActingAs'))
        FROM NetworkActor
        WHERE id in :networkActorIDs;`;
      return config.db.query(
        actorIDsQuery,
        { params: { networkActorIDs } },
      );
    })
    .then((actors) => _.map(actors, 'id'))
    .then((actorIDs) => {
      const detailsQuery = `SELECT set(@rid).size() as numberOfWinningBids,
      sum(price.netAmountEur) as amountOfMoneyExchanged,
      list(price.netAmountEur).size() as numberOfAvailablePrices,
      set(@rid) as bidRIDs
        FROM (
          SELECT *
          FROM Bid
          WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
          AND in('${edgeToBidClass}').id in :actorIDs
          AND isWinning=true
        );`;
      return config.db.query(
        detailsQuery,
        { params: Object.assign({}, network.query, { actorIDs }) },
      );
    })
    .then((result) => {
      const details = result[0];
      Object.assign(node, _.pick(details, ['numberOfWinningBids', 'amountOfMoneyExchanged']));
      node.percentValuesMissing = 100 - (
        (_.get(details, 'numberOfAvailablePrices', 0) * 100) / details.numberOfWinningBids
      );
      return Promise.map(details.bidRIDs, (bidRID) => retrieveBidWithRelated(bidRID, network));
    })
    .then((bids) => {
      node.winningBids = bids;
      return node;
    });
}

function retrieveBidWithRelated(bidRID, network) {
  return config.db.select()
    .from('Bid')
    .where({ '@rid': bidRID })
    .fetch({
      out_AppliedTo: 4,
      in_Awards: 2,
      in_Participates: 2,
    })
    .one()
    .then((result) => {
      const bid = _.pick(result, ['isWinning', 'isSubcontracted']);
      bid.TEDCANID = result.xTEDCANID;
      bid.value = _.get(result, 'price.netAmountEur') || undefined;
      const lot = _.filter(
        _.valuesIn(result.out_AppliedTo._prefetchedRecords),
        { '@class': 'Lot' },
      )[0];
      const tender = _.filter(
        _.valuesIn(result.out_AppliedTo._prefetchedRecords),
        { '@class': 'Tender' },
      )[0];
      bid.lot = _.pick(lot, ['title', 'description', 'bidsCount', 'selectionMethod']);
      bid.lot.awardDecisionDate = moment(lot.awardDecisionDate).format('YYYY-MM-DD');
      bid.lot.addressOfImplementation = _.pick(
        lot.addressOfImplementation,
        ['rawAddress', 'nuts', 'city', 'country', 'street'],
      );
      bid.lot.estimatedValue = _.get(lot, 'estimatedPrice.netAmountEur') || undefined;
      bid.lot.tender = _.pick(tender, ['id', 'title', 'titleEnglish', 'description',
        'isCoveredByGpa', 'isFrameworkAgreement', 'procedureType', 'year', 'country']);
      bid.lot.tender.isEUFunded = tender.xIsEuFunded;
      bid.lot.tender.TEDCNID = tender.xTEDCNID;
      bid.lot.tender.finalValue = _.get(tender, 'finalPrice.netAmountEur') || undefined;

      const bidders = _.filter(
        _.valuesIn(_.get(result, 'in_Participates._prefetchedRecords')),
        { '@class': 'Bidder' },
      );
      const buyers = _.filter(
        _.valuesIn(_.get(result, 'in_Awards._prefetchedRecords')),
        { '@class': 'Buyer' },
      );
      return Promise.join(
        Promise.map(bidders, (bidder) => formatActor(bidder, network)),
        Promise.map(buyers, (buyer) => formatActor(buyer, network)),
        (formattedBidders, formattedBuyers) => {
          bid.bidders = formattedBidders;
          bid.lot.tender.buyers = formattedBuyers;
          return bid;
        },
      );
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
      if (networkActor.active === false) {
        return networkActor.clusterIDs[0];
      }
      return networkActor.id;
    })
    .then((nodeID) => {
      const formattedActor = actorsController.formatActor(actor);
      formattedActor.nodeID = nodeID;
      return formattedActor;
    });
}

module.exports = {
  getNetworkActor,
  retrieveBidWithRelated,
  formatActor,
  formatNetworkActor,
};

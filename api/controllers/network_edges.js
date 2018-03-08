'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const config = require('../../config/default');
const clusterWriters = require('../writers/actor_cluster');
const networkWriters = require('../writers/network');
const networkActorsController = require('../controllers/network_actors');
const codes = require('../helpers/codes');
const formatError = require('../helpers/errorFormatter');

function getNetworkEdge(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const edgeUUID = req.swagger.params.edgeID.value;
  return Promise.join(
    clusterWriters.retrieveNetwork(networkID),
    config.db.select(`*,
      out.id as \`from\`,
      in.id as to,
      @class.toLowerCase() as type`)
      .from('NetworkEdge')
      .where({ uuid: edgeUUID })
      .one(),
    (network, networkEdge) => {
      if (networkEdge.type === 'partners') {
        throw codes.NotImplemented('No details available for an edge of type "partners".');
      }
      return formatContractsEdge(network, networkEdge);
    },
  )
    .then((networkEdge) => res.status(codes.SUCCESS).json({
      edge: networkEdge,
    }))
    .catch((err) => formatError(err, req, res));
}

function formatContractsEdge(network, networkEdge) {
  const edge = _.pick(networkEdge, ['from', 'to', 'type']);
  edge.id = networkEdge.uuid;
  const actorIDsQuery = `SELECT out.in('ActingAs').id as edgeBuyerIDs,    
    in.in('ActingAs').id as edgeBidderIDs
    FROM NetworkEdge
    WHERE uuid=:edgeUUID;`;
  return config.db.query(
    actorIDsQuery,
    { params: { edgeUUID: networkEdge.uuid } },
  )
    .then((result) => {
      const detailsQuery = `SELECT set(@rid).size() as numberOfWinningBids,
      sum(price.netAmountEur) as amountOfMoneyExchanged,
      list(price.netAmountEur).size() as numberOfAvailablePrices,
      set(@rid) as bidRIDs
        FROM (
          SELECT *
          FROM Bid
          WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
          AND in('Awards').id in :edgeBuyerIDs          
          AND in('Participates').id in :edgeBidderIDs
          AND isWinning=true
        );`;
      const params = Object.assign(
        {
          edgeBuyerIDs: result[0].edgeBuyerIDs,
          edgeBidderIDs: result[0].edgeBidderIDs,
        },
        network.query,
      );
      return config.db.query(detailsQuery, { params });
    })
    .then((result) => {
      const details = result[0];
      Object.assign(edge, _.pick(details, ['numberOfWinningBids', 'amountOfMoneyExchanged']));
      edge.percentValuesMissing = 100 - (
        (_.get(details, 'numberOfAvailablePrices', 0) * 100) / details.numberOfWinningBids
      );
      return Promise.map(details.bidRIDs, (bidRID) =>
        networkActorsController.retrieveBidWithRelated(bidRID, network));
    })
    .then((bids) => {
      edge.winningBids = bids;
      return edge;
    });
}

module.exports = {
  getNetworkEdge,
};

'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const config = require('../../config/default');
const networkWriters = require('../writers/network');
const bidSerializer = require('./bid');

function formatEdge(networkEdge) {
  const formattedEdge = _.pick(networkEdge, ['from', 'to', 'type', 'value']);
  formattedEdge.id = networkEdge.uuid;
  formatEdge.flags = {};
  formattedEdge.hidden = !networkEdge.active;
  return formattedEdge;
}

function formatContractsEdgeWithDetails(network, networkEdge) {
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
        config.db.select()
          .from('Bid')
          .where({ '@rid': bidRID })
          .one()
          .then((bid) => bidSerializer.formatBidWithRelated(network, bid)));
    })
    .then((bids) => {
      edge.winningBids = bids;
      return edge;
    });
}

module.exports = {
  formatEdge,
  formatContractsEdgeWithDetails,
};

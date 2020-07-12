'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const config = require('../../config/default');
const networkWriters = require('../writers/network');
const bidSerializer = require('./bid');
const actor = require('./actor');

function formatNetworkActor(networkActor) {
  const formattedActor = _.pick(
    networkActor,
    ['id', 'label', 'type', 'medianCompetition', 'value'],
  );
  formattedActor.flags = {};
  formattedActor.hidden = !networkActor.active;
  return formattedActor;
}

function formatActorWithDetails(network, networkActor, nodeIDs) {
  const node = _.pick(networkActor, ['label', 'id', 'type', 'medianCompetition', 'value', 'countries']);
  node.flags = {};
  node.hidden = !networkActor.active;
  const edgeToBidClass = networkActor.type === 'buyer' ? 'Awards' : 'Participates';
  const networkActorIDs = nodeIDs || [networkActor.id];
  const actorIDsQuery = `SELECT expand(in('ActingAs'))
    FROM NetworkActor
    WHERE id in :networkActorIDs;`;
  return config.db.query(actorIDsQuery, { params: { networkActorIDs } })
    .then((actors) => _.map(actors, 'id'))
    .then((actorIDs) => {
      const detailsQuery = `SELECT bidIDs,
      bidIDs.size() as numberOfWinningBids,
      bidSum as amountOfMoneyExchanged,
      priceList.size() as numberOfAvailablePrices
      FROM (
        SELECT set(id) as bidIDs,
        sum(price.netAmountEur) as bidSum,
        list(price.netAmountEur) as priceList
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
      return Promise.map(details.bidIDs, (bidID) =>
        config.db.select()
          .from('Bid')
          .where({ id: bidID })
          .one()
          .then((bid) => bidSerializer.formatBidWithRelated(network, bid)));
    })
    .then((bids) => {
      node.winningBids = bids;
      return node;
    });
}

function formatActorBids(network, networkActor, limit = 10, page = 1) {
  const edgeToBidClass = networkActor.type === 'buyer' ? 'Awards' : 'Participates';
  const actorIDsQuery = `SELECT expand(in('ActingAs'))
    FROM NetworkActor
    WHERE id in :networkActorID;`;
  const skip = (page - 1) * limit;
  return config.db.query(actorIDsQuery, { params: { networkActorID: networkActor.id } })
    .then((actors) => _.map(actors, 'id'))
    .then((actorIDs) => {
      const actorBidsQuery = `SELECT *
        FROM Bid
        WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
        AND in('${edgeToBidClass}').id in :actorIDs
        AND isWinning=true
        LIMIT :limit
        SKIP :skip;`;
      const queryParams = Object.assign({}, network.query, { 
          actorIDs,
          limit,
          skip,
        });
      return config.db.query(
        actorBidsQuery,
        { params: queryParams },
      );
    })
    .then((bids) => {
      return Promise.map(bids, (bid) => bidSerializer.formatBidWithRelated(network, bid));
    });
}

module.exports = {
  formatNetworkActor,
  formatActorWithDetails,
  formatActorBids,
};

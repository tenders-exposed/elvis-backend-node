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
      const priceListQuery = `SELECT list(price.netAmountEur) as priceList
          FROM Bid
          WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
          AND in('${edgeToBidClass}').id in :actorIDs
          AND isWinning=true;`;
      return config.db.query(
        priceListQuery,
        { params: Object.assign({}, network.query, { actorIDs }) },
      );
    })
    .then((result) => {
      const priceList = _.get(result[0], 'priceList', []);
      const numberOfAvailablePrices = priceList.length;
      node.percentValuesMissing = 100 - ((numberOfAvailablePrices * 100) / networkActor.numberOfWinningBids);
      return node;
    });
}

function formatActorBids(network, networkActor, limit = 10, page = 1, nodeIDs) {
  const skip = (page - 1) * limit;
  const edgeToBidClass = networkActor.type === 'buyer' ? 'Awards' : 'Participates';
  const networkActorIDs = nodeIDs || [networkActor.id];
  const actorIDsQuery = `SELECT expand(in('ActingAs'))
    FROM NetworkActor
    WHERE id in :networkActorIDs;`;
  return config.db.query(actorIDsQuery, { params: { networkActorIDs: networkActorIDs } })
    .then((actors) => _.map(actors, 'id'))
    .then((actorIDs) => {
      const actorBidsQuery = `SELECT *
        FROM Bid
        WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
        AND in('${edgeToBidClass}').id in :actorIDs
        AND isWinning=true
        LIMIT :limit
        SKIP :skip;`;
      const params = Object.assign({}, network.query, {
          actorIDs,
          limit,
          skip,
        });
      return config.db.query(actorBidsQuery, { params });
    })
    .then((bids) => Promise.map(bids, (bid) => bidSerializer.formatBidWithRelated(network, bid)));
}

module.exports = {
  formatNetworkActor,
  formatActorWithDetails,
  formatActorBids,
};

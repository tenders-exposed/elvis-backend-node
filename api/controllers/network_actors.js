'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const config = require('../../config/default');
const clusterWriters = require('../writers/actor_cluster');
const networkActorSerializer = require('../serializers/network_actor');
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
    (network, networkActor) => {
      if (_.isUndefined(networkActor) === true) {
        throw new codes.NotFoundError('Network actor not found.');
      }
      if (network.xUpdateNeeded === true) {
        throw new codes.BadRequestError('Actor details unavailable until you update the network.');
      }
      return networkActorSerializer.formatActorWithDetails(network, networkActor);
    },
  )
    .then((networkActor) => res.status(codes.SUCCESS).json({
      node: networkActor,
    }))
    .catch((err) => formatError(err, req, res));
}

function getNetworkActorBids(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const nodeID = req.swagger.params.nodeID.value;
  const limit = req.swagger.params.limit.value || 10;
  const page = req.swagger.params.page.value || 1;
  return Promise.join(
    clusterWriters.retrieveNetwork(networkID),
    config.db.select()
      .from('NetworkActor')
      .where({ id: nodeID })
      .one(),
    (network, networkActor) => {
      if (_.isUndefined(networkActor) === true) {
        throw new codes.NotFoundError('Network actor not found.');
      }
      if (network.xUpdateNeeded === true) {
        throw new codes.BadRequestError('Actor bids unavailable until you update the network.');
      }
      return networkActorSerializer.formatActorBids(network, networkActor, limit, page);
    },
  )
    .then((networkActorBids) => res.status(codes.SUCCESS).json(networkActorBids))
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  getNetworkActor,
  getNetworkActorBids,
};

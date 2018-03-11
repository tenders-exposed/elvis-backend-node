'use strict';

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
    (network, networkActor) =>
      networkActorSerializer.formatActorWithDetails(network, networkActor),
  )
    .then((networkActor) => res.status(codes.SUCCESS).json({
      node: networkActor,
    }))
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  getNetworkActor,
};

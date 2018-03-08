'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const config = require('../../config/default');
const writers = require('../writers/actor_cluster');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');
const clusterWriters = require('../writers/actor_cluster');
const networkActorController = require('./network_actors');

function createCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterParams = req.swagger.params.body.value.cluster;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return writers.createCluster(networkID, clusterParams)
        .then((cluster) => formatCluster(cluster))
        .then((cluster) => res.status(codes.CREATED).json({
          cluster,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'), req, res);
  });
}

function updateCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterID = req.swagger.params.clusterID.value;
  const clusterParams = req.swagger.params.body.value.cluster;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return writers.updateCluster(networkID, clusterID, clusterParams)
        .then((cluster) => formatCluster(cluster))
        .then((cluster) => res.status(codes.SUCCESS).json({
          cluster,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'), req, res);
  });
}

function deleteCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterID = req.swagger.params.clusterID.value;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return writers.deleteCluster(networkID, clusterID)
        .then(() => res.status(codes.NO_CONTENT).json())
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'), req, res);
  });
}

function getCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterID = req.swagger.params.clusterID.value;
  return Promise.join(
    clusterWriters.retrieveNetwork(networkID),
    clusterWriters.retrieveCluster(networkID, clusterID),
    (network, networkCluster) =>
      networkActorController.formatNetworkActor(network, networkCluster),
  )
    .then((cluster) => res.status(codes.SUCCESS).json({
      cluster,
    }))
    .catch((err) => formatError(err, req, res));
}

function formatCluster(networkCluster) {
  const cluster = _.pick(networkCluster, ['label', 'id', 'type', 'medianCompetition', 'value']);
  cluster.flags = {};
  cluster.hidden = !networkCluster.active;
  return config.db.select("expand(out('Includes'))")
    .from('ActorCluster')
    .where({ id: networkCluster.id })
    .all()
    .then((nodes) => _.map(nodes, 'id'))
    .then((nodes) => {
      cluster.nodes = nodes;
      return cluster;
    });
}

module.exports = {
  createCluster,
  updateCluster,
  deleteCluster,
  getCluster,
};

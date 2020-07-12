'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const writers = require('../writers/actor_cluster');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');
const clusterWriters = require('../writers/actor_cluster');
const clusterSerializer = require('../serializers/actor_cluster');

function createCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterParams = req.swagger.params.body.value.cluster;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return writers.createCluster(networkID, clusterParams)
        .then((cluster) => clusterSerializer.formatCluster(cluster))
        .then((cluster) => res.status(codes.CREATED).json({
          cluster,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(new codes.UnauthorizedError('This operation requires authorization.'), req, res);
  });
}

function updateCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterID = req.swagger.params.clusterID.value;
  const clusterParams = req.swagger.params.body.value.cluster;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return writers.updateCluster(networkID, clusterID, clusterParams)
        .then((cluster) => clusterSerializer.formatCluster(cluster))
        .then((cluster) => res.status(codes.SUCCESS).json({
          cluster,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(new codes.UnauthorizedError('This operation requires authorization.'), req, res);
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
    return formatError(new codes.UnauthorizedError('This operation requires authorization.'), req, res);
  });
}

function getCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterID = req.swagger.params.clusterID.value;
  return Promise.join(
    clusterWriters.retrieveNetwork(networkID),
    clusterWriters.retrieveCluster(networkID, clusterID),
    (network, networkCluster) => {
      if (network.xUpdateNeeded === true) {
        throw new codes.BadRequestError('Cluster details unavailable until you update the network.');
      }
      return clusterSerializer.formatClusterWithDetails(network, networkCluster)
    }
  )
    .then((cluster) => res.status(codes.SUCCESS).json({
      cluster,
    }))
    .catch((err) => formatError(err, req, res));
}

function getClusterBids(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterID = req.swagger.params.clusterID.value;
  const limit = req.swagger.params.limit.value || 10;
  const page = req.swagger.params.page.value || 1;
  return Promise.join(
    clusterWriters.retrieveNetwork(networkID),
    clusterWriters.retrieveCluster(networkID, clusterID),
    (network, networkCluster) => {
      if (network.xUpdateNeeded === true) {
        throw new codes.BadRequestError('Cluster bids unavailable until you update the network.');
      }
      return clusterSerializer.formatClusterBids(network, networkCluster, limit, page)
    }
  )
    .then((networkClusterBids) => res.status(codes.SUCCESS).json(networkClusterBids))
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  createCluster,
  updateCluster,
  deleteCluster,
  getCluster,
  getClusterBids,
};

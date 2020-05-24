'use strict';

const moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');

const config = require('../../config/default');
const writers = require('../writers/network');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');
const networkSerializer = require('../serializers/network');

function createNetwork(req, res) {
  const networkParams = req.swagger.params.body.value.network;
  return validateToken(req, res, () =>
    writers.createNetwork(networkParams, req.user)
      .then((network) => networkSerializer.formatNetworkWithRelated(network))
      .then((network) => res.status(codes.CREATED).json({
        network,
      }))
      .catch((err) => formatError(err, req, res)));
}

function deleteNetwork(req, res) {
  const networkID = req.swagger.params.networkID.value;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return config.db.select("*, in('Owns').id as userIDS")
        .from('Network')
        .where({ id: networkID })
        .one()
        .then((network) => {
          if (_.isUndefined(network) === true) {
            throw new codes.NotFoundError('Network not found.');
          }
          if (network.userIDS[0] !== req.user.id) {
            throw new codes.UnauthorizedError('Network does not belong to this user');
          }
          return config.db.vertex.delete(network);
        })
        .then(() => res.status(codes.NO_CONTENT).json())
        .catch((err) => formatError(err, req, res));
    }
    return formatError(new codes.UnauthorizedError('This operation requires authorization.'), req, res);
  });
}

function updateNetwork(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const networkParams = req.swagger.params.body.value.network;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return config.db.select("*, in('Owns').id as userIDS")
        .from('Network')
        .where({ id: networkID })
        .one()
        .then((network) => {
          const ownerID = network.userIDS[0];
          if (_.isUndefined(network) === true) {
            throw new codes.NotFoundError('Network not found.');
          }
          if (_.isUndefined(ownerID) == false && ownerID !== req.user.id) {
            throw new codes.UnauthorizedError('Network does not belong to this user');
          }
          const newNetworkQuery = _.get(networkParams, 'query', undefined);
          const newNetworkSettings = _.get(networkParams, 'settings', undefined);
          // No point recalculating the network if only the name and synopsis are changed
          if (_.isUndefined(newNetworkQuery) === true && _.isUndefined(newNetworkSettings) === true) {
            networkParams.updated = moment().format('YYYY-MM-DD HH:mm:ss');
            return config.db.update('Network')
              .set(networkParams)
              .where({ id: network.id })
              .return('AFTER')
              .commit()
              .one();
          } else {
            return writers.updateNetwork(networkParams, network);
          }
        })
        .then((network) => networkSerializer.formatNetworkWithRelated(network))
        .then((network) => res.status(codes.SUCCESS).json({
          network,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(new codes.UnauthorizedError('This operation requires authorization.'), req, res);
  });
}

function getNetwork(req, res) {
  const networkID = req.swagger.params.networkID.value;
  return config.db.select()
    .from('Network')
    .where({ id: networkID })
    .one()
    .then((network) => {
      if (_.isUndefined(network) === true) {
        throw new codes.NotFoundError('Network not found');
      }
      return networkSerializer.formatNetworkWithRelated(network);
    })
    .then((network) => res.status(codes.SUCCESS).json({
      network,
    }))
    .catch((err) => formatError(err, req, res));
}

function getNetworks(req, res) {
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return config.db.select()
        .from('Network')
        .where({ "in('Owns').id": req.user.id })
        .all()
        .then((networks) =>
          Promise.map(networks, (network) => networkSerializer.formatNetwork(network)))
        .then((networks) => res.status(codes.SUCCESS).json({
          networks,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(new codes.UnauthorizedError('This operation requires authorization.'), req, res);
  });
}

module.exports = {
  createNetwork,
  deleteNetwork,
  updateNetwork,
  getNetwork,
  getNetworks,
};

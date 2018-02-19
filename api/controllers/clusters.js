'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const writers = require('../writers/network');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');
const networkController = require('./networks');

function createCluster(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const clusterParams = req.swagger.params.body.value.cluster;
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return writers.createCluster(networkID, clusterParams)
        .then((network) => networkController.formatNetworkWithRelated(network))
        .then((network) => res.status(codes.CREATED).json({
          network,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'), req, res);
  });
}

module.exports = {
  createCluster,
};


'use strict';

const _ = require('lodash');

const config = require('../../config/default');
const writers = require('../writers/actor_cluster');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');

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

function formatCluster(networkCluster) {
  console.log(networkCluster);
  const cluster = _.pick(networkCluster, ['label', 'id', 'type', 'medianCompetition',
    'value', 'country']);
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
};

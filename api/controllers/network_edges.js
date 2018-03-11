'use strict';

const Promise = require('bluebird');

const config = require('../../config/default');
const clusterWriters = require('../writers/actor_cluster');
const codes = require('../helpers/codes');
const formatError = require('../helpers/errorFormatter');
const edgeSerializer = require('../serializers/network_edge');

function getNetworkEdge(req, res) {
  const networkID = req.swagger.params.networkID.value;
  const edgeUUID = req.swagger.params.edgeID.value;
  return Promise.join(
    clusterWriters.retrieveNetwork(networkID),
    config.db.select(`*,
      out.id as \`from\`,
      in.id as to,
      @class.toLowerCase() as type`)
      .from('NetworkEdge')
      .where({ uuid: edgeUUID })
      .one(),
    (network, networkEdge) => {
      if (networkEdge.type === 'partners') {
        throw codes.NotImplemented('No details available for an edge of type "partners".');
      }
      return edgeSerializer.formatContractsEdgeWithDetails(network, networkEdge);
    },
  )
    .then((networkEdge) => res.status(codes.SUCCESS).json({
      edge: networkEdge,
    }))
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  getNetworkEdge,
};

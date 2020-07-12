'use strict';

const _ = require('lodash');
const config = require('../../config/default');
const networkActorSerializer = require('./network_actor');

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

function formatClusterWithDetails(network, networkCluster) {
  return config.db.select("expand(out('Includes'))")
    .from('NetworkActor')
    .where({ id: networkCluster.id })
    .all()
    .then((nodes) => _.map(nodes, 'id'))
    .then((nodeIDs) =>
      networkActorSerializer.formatActorWithDetails(network, networkCluster, nodeIDs)
        .then((cluster) => {
          cluster.nodes = nodeIDs;
          return cluster;
        }));
}

function formatClusterBids(network, networkCluster, limit, page) {
  return config.db.select("expand(out('Includes'))")
  .from('NetworkActor')
  .where({ id: networkCluster.id })
  .all()
  .then((nodes) => _.map(nodes, 'id'))
  .then((nodeIDs) => networkActorSerializer.formatActorBids(network, networkCluster, limit, page, nodeIDs));
}

module.exports = {
  formatCluster,
  formatClusterWithDetails,
  formatClusterBids,
};

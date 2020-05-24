'use strict';

const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');

const config = require('../../config/default');
const networkActorSerializer = require('./network_actor');
const networkEdgeSerializer = require('./network_edge');
const actorClusterSerializer = require('./actor_cluster');

function formatNetwork(network) {
  const prettyNetwork = _.pick(network, ['id', 'name', 'synopsis', 'xUpdateNeeded']);
  prettyNetwork.created = moment(network.created).format();
  prettyNetwork.updated = moment(network.updated).format();
  prettyNetwork.settings = _.pick(network.settings, ['nodeSize', 'edgeSize']);
  prettyNetwork.query = _.pick(network.query, ['countries', 'years', 'cpvs', 'bidders', 'buyers']);
  prettyNetwork.count = {};
  const nodeCountQuery = `SELECT in('PartOf').size() as nodeCount
    FROM Network
    WHERE id=:networkID`;
  const edgeCountQuery = (edgeName) =>
    `SELECT in('PartOf').out('${edgeName}').size() as edgeCount
    FROM Network
    WHERE id=:networkID`;
  return Promise.join(
    config.db.query(nodeCountQuery, { params: { networkID: network.id } }),
    config.db.query(edgeCountQuery('Contracts'), { params: { networkID: network.id } }),
    config.db.query(edgeCountQuery('Partners'), { params: { networkID: network.id } }),
    (nodeResult, contractsResult, partnersResult) => {
      prettyNetwork.count.nodeCount = nodeResult[0].nodeCount;
      prettyNetwork.count.edgeCount = contractsResult[0].edgeCount + partnersResult[0].edgeCount;
      return prettyNetwork;
    },
  );
}

function formatNetworkWithRelated(network) {
  return formatNetwork(network)
    .then((prettyNetwork) => {
      const networkID = network.id;
      const nodesQuery = `SELECT *
        FROM NetworkActor
        WHERE out('PartOf').id=:networkID
        AND @class='NetworkActor'`;
      const edgesQuery = (className) => `SELECT *,
        out.id as \`from\`,
        in.id as to,
        @class.toLowerCase() as type
        FROM ${className}
        WHERE out.out('PartOf').id=:networkID;`;
      const clustersQuery = `SELECT *
        FROM ActorCluster
        WHERE out('PartOf').id=:networkID;`;
      return Promise.join(
        config.db.query(nodesQuery, { params: { networkID } }),
        config.db.query(edgesQuery('Contracts'), { params: { networkID } }),
        config.db.query(edgesQuery('Partners'), { params: { networkID } }),
        config.db.query(clustersQuery, { params: { networkID } }),
        (nodes, contractsEdges, partnersEdges, clusters) => {
          prettyNetwork.nodes = nodes.map((node) =>
            networkActorSerializer.formatNetworkActor(node));
          prettyNetwork.edges = _.concat(contractsEdges, partnersEdges)
            .map((edge) => networkEdgeSerializer.formatEdge(edge));
          return Promise.map(clusters, (cluster) =>
            actorClusterSerializer.formatCluster(cluster));
        },
      ).then((formattedClusters) => {
        prettyNetwork.clusters = formattedClusters;
        return prettyNetwork;
      });
    });
}

module.exports = {
  formatNetwork,
  formatNetworkWithRelated,
};

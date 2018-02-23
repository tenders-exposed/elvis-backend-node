'use strict';

const moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');

const config = require('../../config/default');
const writers = require('../writers/network');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');

function createNetwork(req, res) {
  const networkParams = req.swagger.params.body.value.network;
  return validateToken(req, res, () =>
    writers.createNetwork(networkParams, req.user)
      .then((network) => formatNetworkWithRelated(network))
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
            throw codes.NotFound('Network not found.');
          }
          if (network.userIDS[0] !== req.user.id) {
            throw codes.Unauthorized('Network does not belong to this user');
          }
          return config.db.vertex.delete(network);
        })
        .then(() => res.status(codes.NO_CONTENT).json())
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'), req, res);
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
          if (_.isUndefined(network) === true) {
            throw codes.NotFound('Network not found.');
          }
          if (network.userIDS[0] !== req.user.id) {
            throw codes.Unauthorized('Network does not belong to this user');
          }
          networkParams.updated = moment().format('YYYY-MM-DD HH:mm:ss');
          return config.db.update('Network')
            .set(networkParams)
            .where({ '@rid': network['@rid'] })
            .return('AFTER')
            .commit()
            .one();
        })
        .then((network) => formatNetworkWithRelated(network))
        .then((network) => res.status(codes.SUCCESS).json({
          network,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'), req, res);
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
        throw codes.NotFound('Network not found');
      }
      return formatNetworkWithRelated(network);
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
          Promise.map(networks, (network) => formatNetwork(network)))
        .then((networks) => res.status(codes.SUCCESS).json({
          networks,
        }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'), req, res);
  });
}

function formatNetwork(network) {
  const prettyNetwork = _.pick(network, ['id', 'name', 'synopsis']);
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

function formatNode(networkActor) {
  const node = _.pick(networkActor, ['label', 'id', 'type', 'medianCompetition',
    'value', 'country']);
  node.flags = {};
  node.hidden = !networkActor.active;
  return node;
}

function formatEdge(networkEdge) {
  const edge = _.pick(networkEdge, ['from', 'to', 'type', 'value']);
  edge.flags = {};
  edge.hidden = !networkEdge.active;
  return edge;
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
      const clustersQuery = `SELECT *,
        out('Includes').id as nodes
        FROM ActorCluster
        WHERE out('PartOf').id=:networkID;`;
      return Promise.join(
        config.db.query(nodesQuery, { params: { networkID } }),
        config.db.query(edgesQuery('Contracts'), { params: { networkID } }),
        config.db.query(edgesQuery('Partners'), { params: { networkID } }),
        config.db.query(clustersQuery, { params: { networkID } }),
        (nodes, contractsEdges, partnersEdges, clusters) => {
          prettyNetwork.nodes = nodes.map((node) => formatNode(node));
          prettyNetwork.edges = _.concat(contractsEdges, partnersEdges)
            .map((edge) => formatEdge(edge));
          prettyNetwork.clusters = clusters.map((cluster) =>
            Object.assign(formatNode(cluster), { nodes: cluster.nodes }));
          return prettyNetwork;
        },
      );
    });
}

module.exports = {
  createNetwork,
  deleteNetwork,
  updateNetwork,
  getNetwork,
  getNetworks,
  formatNetwork,
  formatNetworkWithRelated,
};

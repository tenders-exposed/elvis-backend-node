'use strict';

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
    return formatError(codes.Unauthorized('This operation requires authorization.'));
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
          res.status(codes.SUCCESS).json({
            networks: _.map(networks, (network) => formatNetwork(network)),
          }))
        .catch((err) => formatError(err, req, res));
    }
    return formatError(codes.Unauthorized('This operation requires authorization.'));
  });
}

function formatNetwork(network) {
  const prettyNetwork = _.pick(network, ['id', 'name', 'synopsis']);
  prettyNetwork.settings = _.pick(network.settings, ['nodeSize', 'edgeSize']);
  prettyNetwork.query = _.pick(network.query, ['countries', 'years', 'cpvs', 'bidders', 'buyers']);
  return prettyNetwork;
}

function formatNetworkWithRelated(network) {
  const prettyNetwork = formatNetwork(network);
  const networkID = network.id;
  const nodesQuery = `SELECT *
    FROM NetworkActor
    WHERE out('PartOf').id=:networkID
    AND visible=true;`;
  const edgesQuery = (className) => `SELECT *,
    in.id as \`from\`,
    out.id as to,
    @class.toLowerCase() as type
    FROM ${className}
    WHERE visible=true
    AND out.out('PartOf').id=:networkID;`;
  return Promise.join(
    config.db.query(nodesQuery, { params: { networkID } }),
    config.db.query(edgesQuery('Contracts'), { params: { networkID } }),
    config.db.query(edgesQuery('Partners'), { params: { networkID } }),
    (nodes, contractsEdges, partnersEdges) => {
      prettyNetwork.nodes = nodes.map((node) =>
        _.pick(node, ['label', 'id', 'type', 'medianCompetition', 'value', 'country', 'visible']));
      prettyNetwork.edges = _.concat(contractsEdges, partnersEdges).map((edge) =>
        _.pick(edge, ['from', 'to', 'type', 'value', 'visible']));
      prettyNetwork.count = {
        nodes: prettyNetwork.nodes.length,
        edges: prettyNetwork.edges.length,
      };
      return prettyNetwork;
    },
  );
}

module.exports = {
  createNetwork,
  deleteNetwork,
  getNetwork,
  getNetworks,
  formatNetwork,
  formatNetworkWithRelated,
};

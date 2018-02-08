'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const config = require('../../config/default');
const writers = require('../networkWriters');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');

function createNetwork(req, res) {
  const networkParams = req.swagger.params.body.value;
  const networkQuery = _.pickBy(networkParams.query, (val) => !(_.isUndefined(val)));
  if (_.isEmpty(networkQuery) === true) {
    throw codes.BadRequest('Network "query" can\'t be empty.');
  }

  return validateToken(req, res, () =>
    writers.createNetwork(networkParams, req.user))
    .then((network) => formatNetwork(network))
    .then((network) => res.status(codes.CREATED).json(network))
    .catch((err) => formatError(err, req, res));
}

function formatNetwork(network) {
  const networkID = network.id;
  const networkQuery = `SELECT *
    FROM Network
    WHERE id=:networkID;`;
  return config.db.query(networkQuery, { params: { networkID: network.id } })
    .then((results) => {
      const rawNetwork = results[0];
      const prettyNetwork = _.pick(rawNetwork, ['id', 'name', 'synopsis']);
      prettyNetwork.settings = _.pick(rawNetwork.settings, ['nodeSize', 'edgeSize']);
      prettyNetwork.query = _.pick(rawNetwork.query, ['countries', 'years', 'cpvs', 'bidders', 'buyers']);
      return prettyNetwork;
    })
    .then((prettyNetwork) => {
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
      const userQuery = `SELECT *
        FROM User
        WHERE out('Owns').id in [:networkID];`;
      return Promise.join(
        config.db.query(nodesQuery, { params: { networkID } }),
        config.db.query(edgesQuery('Contracts'), { params: { networkID } }),
        config.db.query(edgesQuery('Partners'), { params: { networkID } }),
        config.db.query(userQuery, { params: { networkID } }),
        (nodes, contractsEdges, partnersEdges, users) => {
          prettyNetwork.nodes = nodes.map((node) =>
            _.pick(node, ['label', 'id', 'type', 'medianCompetition', 'value', 'country']));
          prettyNetwork.edges = _.concat(contractsEdges, partnersEdges).map((edge) =>
            _.pick(edge, ['from', 'to', 'type', 'value']));
          prettyNetwork.count = {
            nodes: prettyNetwork.nodes.length,
            edges: prettyNetwork.edges.length,
          };
          if (_.isUndefined(users[0]) === false) {
            prettyNetwork.user = _.pick(users[0], ['id', 'email']);
          }
          return prettyNetwork;
        },
      );
    });
}

module.exports = {
  createNetwork,
  formatNetwork,
};

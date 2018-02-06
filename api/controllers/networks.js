'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const Promise = require('bluebird');
const moment = require('moment');

const config = require('../../config/default');
const codes = require('../helpers/codes');
const validateToken = require('../middlewares/validateToken');
const formatError = require('../helpers/errorFormatter');

function createNetwork(req, res) {
  const networkParams = req.swagger.params.body.value;
  const networkQuery = _.pickBy(networkParams.query, (val) => !(_.isUndefined(val)));
  if (_.isEmpty(networkQuery) === true) {
    throw codes.BadRequest('Network query can\'t be empty.');
  }
  const bidFilters = queryToBidFilters(networkQuery);
  const nodeValueQuery = settingsToValueQuery(networkParams.settings.nodeSize);
  const edgeValueQuery = settingsToValueQuery(networkParams.settings.edgeSize);

  // createContractsEdges(bidFilters, edgeValueQuery, networkQuery),
  const networkAttrs = Object.assign({}, networkParams);
  Object.assign(networkAttrs, {
    query: networkQuery,
    id: uuidv4(),
    created: moment().format('YYYY-MM-DD HH:mm:ss'),
    updated: moment().format('YYYY-MM-DD HH:mm:ss'),
  });
  return config.db.create('vertex', 'Network')
    .set(networkAttrs)
    .commit()
    .one()
    .then((network) => Promise.join(
      createBuyerNodes(bidFilters, nodeValueQuery, network),
      createBidderNodes(bidFilters, nodeValueQuery, network),
      (buyerNodes, bidderNodes) => {
        network.nodes = _.concat(buyerNodes, bidderNodes);
        return network;
      },
    ))
    .then((network) => Promise.join(
      createContractsEdges(bidFilters, edgeValueQuery, network),
      createPartnersEdges('Buyer', 'Awards', bidFilters, edgeValueQuery, network),
      createPartnersEdges('Bidder', 'Participates', bidFilters, edgeValueQuery, network),
      (contractsEdges, buyerConsortiaEdges, bidderConsortiaEdges) => {
        network.edges = _.concat(contractsEdges, buyerConsortiaEdges, bidderConsortiaEdges);
        return network;
      },
    ))
    .then((network) =>
      validateToken(req, res, () => {
        if (_.isUndefined(req.user) === false) {
          return createOwnsEdge(network, req.user).then(() => {
            network.user = req.user;
            return network;
          });
        }
        return network;
      }))
    .then((network) => res.status(codes.CREATED).json(formatNetwork(network)))
    .catch((err) => formatError(err, req, res));
}

function createOwnsEdge(network, user) {
  return config.db.create('edge', 'Owns')
    .from(user['@rid'])
    .to(network['@rid'])
    .commit()
    .one();
}

function queryToBidFilters(networkQuery) {
  const filters = [];
  const actorFilters = [];
  if (networkQuery.buyers) {
    actorFilters.push("in('Awards').id in :buyers");
  }
  if (networkQuery.bidders) {
    actorFilters.push("in('Participates').id in :bidders");
  }
  if (_.isEmpty(actorFilters) === false) {
    filters.push(`{ as: bids, where: (${_.join(_.compact(actorFilters), ' OR ')})}`);
  }

  if (networkQuery.countries) {
    filters.push('{ as: bids,  where: (xCountry in :countries) }');
  }
  if (networkQuery.years) {
    filters.push('{ as: bids,  where: (xYear in :years) }');
  }
  if (networkQuery.cpvs) {
    filters.push(`{ as: bids }.out('AppliedTo').in('Comprises').out('HasCPV')
      { class: CPV, where: (code in :cpvs)}`);
  }
  return filters;
}

function settingsToValueQuery(sizeSetting) {
  let value;
  if (sizeSetting === 'numberOfWinningBids') {
    value = 'count(bids)';
  } else if (sizeSetting === 'amountOfMoneyExchanged') {
    value = 'sum(bids.price.netAmountEur)';
  }
  return value;
}

function createBidderNodes(bidFilters, valueQuery, network) {
  const bidderNodesQuery = `SELECT bidder.name as label,
    bidder[@rid] as \`@rid\`,
    ${valueQuery} as value,
    median(bids.out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      MATCH { class: Bidder, as: bidder },
        { as: bidder }.out('Participates'){ class: Bid, as: bids },
        ${_.join(bidFilters, ',')}
      RETURN bidder, bids
    ) GROUP BY bidder;`;
  return config.db.query(bidderNodesQuery, { params: network.query })
    .then((bidderNodes) => Promise.map(bidderNodes, (bidderNode) => {
      const nodeAttrs = _.pick(
        bidderNode,
        ['label', 'value', 'medianCompetition'],
      );
      nodeAttrs.type = 'bidder';
      nodeAttrs.visible = true;
      nodeAttrs.id = uuidv4();
      return createNetworkActor(nodeAttrs, bidderNode['@rid'], network['@rid']);
    }));
}

function createBuyerNodes(bidFilters, valueQuery, network) {
  const buyerNodesQuery = `SELECT buyer.name as label,
    buyer[@rid] as \`@rid\`,
    ${valueQuery} as value,
    buyer.address.country as country,
    median(bids.out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      MATCH { class: Buyer, as: buyer },
        { as: buyer }.out('Awards'){ class: Bid, as: bids },
        ${_.join(bidFilters, ',')}
      RETURN buyer, bids
    ) GROUP BY buyer;`;
  return config.db.query(buyerNodesQuery, { params: network.query })
    .then((buyerNodes) => Promise.map(buyerNodes, (buyerNode) => {
      const nodeAttrs = _.pick(
        buyerNode,
        ['label', 'id', 'value', 'medianCompetition', 'country'],
      );
      nodeAttrs.type = 'buyer';
      nodeAttrs.visible = true;
      nodeAttrs.id = uuidv4();
      return createNetworkActor(nodeAttrs, buyerNode['@rid'], network['@rid']);
    }));
}

function createNetworkActor(nodeAttrs, actorRID, networkRID) {
  let node;
  return config.db.create('vertex', 'NetworkActor')
    .set(nodeAttrs)
    .commit()
    .one()
    .then((createdNode) => {
      node = createdNode;
      const networkEdge = config.db.create('edge', 'PartOf')
        .from(createdNode['@rid'])
        .to(networkRID)
        .commit()
        .one();
      const actorEdge = config.db.create('edge', 'ActingAs')
        .from(actorRID)
        .to(createdNode['@rid'])
        .commit()
        .one();
      return Promise.all([networkEdge, actorEdge]);
    })
    .then(() => node);
}

function createContractsEdges(bidFilters, valueQuery, network) {
  const contractsEdgesQuery = `SELECT buyer.id as buyerID,
    bidder.id as bidderID,
    ${valueQuery} as value
    FROM (
      MATCH { class: Bid,  as: bids },
        ${_.join(bidFilters, ',')},
        { as: bids }.in('Awards'){ class: Buyer, as: buyer },
        { as: bids }.in('Participates'){ class: Bidder, as: bidder }
      RETURN bids, buyer, bidder
    ) GROUP BY [buyer, bidder];`;
  return config.db.query(contractsEdgesQuery, { params: network.query })
    .then((contractsEdges) => Promise.map(contractsEdges, (edge) => {
      const edgeAttrs = {
        value: edge.value,
        visible: true,
      };
      return createNetworkEdge('Contracts', edgeAttrs, edge.buyerID, edge.bidderID, network.id);
    }));
}

function createPartnersEdges(actorClass, edgeToBidClass, bidFilters, valueQuery, network) {
  const partnersEdgesQuery = `SELECT actor.id as actorID,
    partner.id as partnerID,
    set(bids).size() as value
    FROM (
      MATCH { class: ${actorClass}, as: actor },
        { as: actor }.out(${edgeToBidClass}){ class: Bid, as: bids },
        ${_.join(bidFilters, ',')},
        { as: bids }.in(${edgeToBidClass}){ class: ${actorClass}, as: partner,
          where: ($matched.actor != $currentMatch)}
      RETURN bids, set(actor, partner) as pair, actor, partner
    ) GROUP BY pair;`;
  return config.db.query(partnersEdgesQuery, { params: network.query })
    .then((partnersEdges) => Promise.map(partnersEdges, (edge) => {
      const edgeAttrs = {
        value: edge.value,
        visible: true,
      };
      return createNetworkEdge('Partners', edgeAttrs, edge.actorID, edge.partnerID, network.id);
    }));
}

function createNetworkEdge(edgeClass, edgeAttrs, fromID, toID, networkID) {
  const networkActorQuery = `SELECT * FROM NetworkActor
    WHERE out('PartOf').id=:networkID AND
    in('ActingAs').id=:actorID;`;
  return Promise.join(
    config.db.query(
      networkActorQuery,
      { params: { actorID: fromID, networkID } },
    ),
    config.db.query(
      networkActorQuery,
      { params: { actorID: toID, networkID } },
    ),
    (fromResults, toResults) =>
      config.db.create('edge', edgeClass)
        .from(fromResults[0]['@rid'])
        .to(toResults[0]['@rid'])
        .set(edgeAttrs)
        .commit()
        .one()
        .then((edge) => {
          edge.from = fromID;
          edge.to = toID;
          return edge;
        }),
  );
}

function formatNode(node) {
  return _.pick(node, ['label', 'id', 'type', 'medianCompetition', 'value', 'country']);
}

function formatEdge(edge) {
  edge.type = _.toLower(edge['@class']);
  return _.pick(edge, ['from', 'to', 'type', 'value']);
}

function formatNetwork(network) {
  network.settings = _.pick(network.settings, ['nodeSize', 'edgeSize']);
  network.query = _.pick(network.query, ['countries', 'years', 'cpvs', 'bidders', 'buyers']);
  network.nodes = network.nodes.map((node) => formatNode(node));
  network.edges = network.edges.map((edge) => formatEdge(edge));
  network.count = {
    nodes: network.nodes.length,
    edges: network.edges.length,
  };
  if (_.isUndefined(network.user) === false) {
    network.user = _.pick(network.user, ['id', 'email']);
  }
  return _.pick(network, ['id', 'name', 'synopsis', 'settings', 'query', 'nodes',
    'edges', 'count', 'user']);
}

module.exports = {
  createNetwork,
};

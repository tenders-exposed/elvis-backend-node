'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuidv4 = require('uuid/v4');
const moment = require('moment');

const config = require('../../config/default');

function recordName(id, className) {
  return `${className.toLowerCase()}${id.replace(/-/g, '')}`;
}

async function createNetwork(networkParams, user) {
  const networkQuery = _.pickBy(networkParams.query, (val) => !(_.isUndefined(val)));
  const networkAttrs = Object.assign({}, networkParams);
  Object.assign(networkAttrs, {
    id: uuidv4(),
    query: networkQuery,
    created: moment().format('YYYY-MM-DD HH:mm:ss'),
    updated: moment().format('YYYY-MM-DD HH:mm:ss'),
  });

  const networkName = recordName(networkAttrs.id, 'Network');
  const transaction = config.db.let(networkName, (t) => {
    t.create('vertex', 'Network')
      .set(networkAttrs);
  });
  await createOwnsEdge(transaction, user, networkName);
  const networkActorsMapping = await Promise.join(
    createBuyerNodes(transaction, networkParams.settings, networkQuery, networkName),
    createBidderNodes(transaction, networkParams.settings, networkQuery, networkName),
    (buyerActorsMapping, bidderActorsMapping) =>
      Object.assign(buyerActorsMapping, bidderActorsMapping),
  );
  await Promise.all([
    createContractsEdges(transaction, networkParams.settings, networkQuery, networkActorsMapping),
    createPartnersEdges(transaction, 'Buyer', 'Awards', networkQuery, networkActorsMapping),
    createPartnersEdges(transaction, 'Bidder', 'Participates', networkQuery, networkActorsMapping),
  ]);

  return transaction.commit(2).return(`$${networkName}`).one();
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

function createOwnsEdge(transaction, user, networkName) {
  if (_.isUndefined(user) === false) {
    const userName = recordName(user.id, 'User');
    transaction.let(`${userName}Owns${networkName}`, (t) => {
      t.create('edge', 'Owns')
        .from(user['@rid'])
        .to(`$${networkName}`);
    });
    return userName;
  }
  return undefined;
}

function createBidderNodes(transaction, networkSettings, networkQuery, networkName) {
  const bidderActorMapping = {};
  const valueQuery = settingsToValueQuery(networkSettings.nodeSize);
  const bidderNodesQuery = `SELECT bidder.name as label,
    bidder[@rid] as \`@rid\`,
    ${valueQuery} as value,
    median(bids.out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      MATCH { class: Bidder, as: bidder },
        { as: bidder }.out('Participates'){ class: Bid, as: bids },
        ${_.join(queryToBidFilters(networkQuery), ',')}
      RETURN bidder, bids
    ) GROUP BY bidder;`;
  return config.db.query(bidderNodesQuery, { params: networkQuery })
    // I avoid using reduce here instead of map to run this in parralel
    .then((bidderNodes) => Promise.map(bidderNodes, (bidderNode) => {
      const nodeAttrs = _.pick(
        bidderNode,
        ['label', 'value', 'medianCompetition'],
      );
      nodeAttrs.type = 'bidder';
      nodeAttrs.visible = true;
      nodeAttrs.id = uuidv4();
      const actorName = createNetworkActor(transaction, nodeAttrs, bidderNode['@rid'], networkName);
      bidderActorMapping[bidderNode['@rid']] = actorName;
      return undefined;
    }))
    .then(() => bidderActorMapping);
}

function createBuyerNodes(transaction, networkSettings, networkQuery, networkName) {
  const buyerActorMapping = {};
  const valueQuery = settingsToValueQuery(networkSettings.nodeSize);
  const buyerNodesQuery = `SELECT buyer.name as label,
    buyer[@rid] as \`@rid\`,
    ${valueQuery} as value,
    buyer.address.country as country,
    median(bids.out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      MATCH { class: Buyer, as: buyer },
        { as: buyer }.out('Awards'){ class: Bid, as: bids },
        ${_.join(queryToBidFilters(networkQuery), ',')}
      RETURN buyer, bids
    ) GROUP BY buyer;`;
  return config.db.query(buyerNodesQuery, { params: networkQuery })
    .then((buyerNodes) => Promise.map(buyerNodes, (buyerNode) => {
      const nodeAttrs = _.pick(
        buyerNode,
        ['label', 'value', 'medianCompetition', 'country'],
      );
      nodeAttrs.type = 'buyer';
      nodeAttrs.visible = true;
      nodeAttrs.id = uuidv4();
      const actorName = createNetworkActor(transaction, nodeAttrs, buyerNode['@rid'], networkName);
      buyerActorMapping[buyerNode['@rid']] = actorName;
      return undefined;
    }))
    .then(() => buyerActorMapping);
}

function createNetworkActor(transaction, nodeAttrs, actorRID, networkName) {
  const actorName = recordName(nodeAttrs.id, 'NetworkActor');
  transaction.let(actorName, (t) => {
    t.create('vertex', 'NetworkActor')
      .set(nodeAttrs);
  });
  transaction.let(`${actorName}PartOf`, (t) => {
    t.create('edge', 'PartOf')
      .from(`$${actorName}`)
      .to(`$${networkName}`);
  });
  transaction.let(`ActingAs${actorName}`, (t) => {
    t.create('edge', 'ActingAs')
      .from(actorRID)
      .to(`$${actorName}`);
  });
  return actorName;
}

function createContractsEdges(transaction, networkSettings, networkQuery, networkActorsMapping) {
  const valueQuery = settingsToValueQuery(networkSettings.edgeSize);
  const contractsEdgesQuery = `SELECT buyer[@rid] as buyerRID,
    bidder[@rid] as bidderRID,
    ${valueQuery} as value
    FROM (
      MATCH { class: Bid,  as: bids },
        ${_.join(queryToBidFilters(networkQuery), ',')},
        { as: bids }.in('Awards'){ class: Buyer, as: buyer },
        { as: bids }.in('Participates'){ class: Bidder, as: bidder }
      RETURN bids, buyer, bidder
    ) GROUP BY [buyer, bidder];`;
  return config.db.query(contractsEdgesQuery, { params: networkQuery })
    .then((contractsEdges) => Promise.map(contractsEdges, (edge) => {
      const edgeAttrs = {
        value: edge.value,
        visible: true,
      };
      const fromName = networkActorsMapping[edge.buyerRID];
      const toName = networkActorsMapping[edge.bidderRID];
      return createNetworkEdge(transaction, 'Contracts', edgeAttrs, fromName, toName);
    }));
}

function createPartnersEdges(transaction, actorClass, edgeToBidClass, networkQuery, networkActorsMapping) { // eslint-disable-line max-len
  const partnersEdgesQuery = `SELECT actor[@rid] as actorRID,
    partner[@rid] as partnerRID,
    set(bids).size() as value
    FROM (
      MATCH { class: ${actorClass}, as: actor },
        { as: actor }.out(${edgeToBidClass}){ class: Bid, as: bids },
        ${_.join(queryToBidFilters(networkQuery), ',')},
        { as: bids }.in(${edgeToBidClass}){ class: ${actorClass}, as: partner,
          where: ($matched.actor != $currentMatch)}
      RETURN bids, set(actor, partner) as pair, actor, partner
    ) GROUP BY pair;`;
  return config.db.query(partnersEdgesQuery, { params: networkQuery })
    .then((partnersEdges) => Promise.map(partnersEdges, (edge) => {
      const edgeAttrs = {
        value: edge.value,
        visible: true,
      };
      const fromName = networkActorsMapping[edge.actorRID];
      const toName = networkActorsMapping[edge.partnerRID];
      return createNetworkEdge(transaction, 'Partners', edgeAttrs, fromName, toName);
    }));
}

function createNetworkEdge(transaction, edgeClass, edgeAttrs, fromName, toName) {
  const edgeName = `${fromName}${edgeClass}${toName}`;
  transaction.let(edgeName, (t) => {
    t.create('edge', edgeClass)
      .from(`$${fromName}`)
      .to(`$${toName}`)
      .set(edgeAttrs);
  });
  return edgeName;
}

module.exports = {
  createNetwork,
  createBidderNodes,
  createBuyerNodes,
  createContractsEdges,
  createPartnersEdges,
  createOwnsEdge,
  createNetworkActor,
  createNetworkEdge,
};

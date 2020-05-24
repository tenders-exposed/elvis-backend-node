'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuidv4 = require('uuid/v4');
const moment = require('moment');

const codes = require('../helpers/codes');
const config = require('../../config/default');

function recordName(id, className) {
  return `${className.toLowerCase()}${id.replace(/-/g, '')}`;
}

async function createNetwork(networkParams, user) {
  const networkQuery = _.pickBy(networkParams.query, (val) => !(_.isUndefined(val)));
  if (_.isEmpty(networkQuery) === true) {
    throw new codes.BadRequestError('Network "query" can\'t be empty.');
  }

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
    createPartnersEdges(transaction, 'Awards', networkQuery, networkActorsMapping),
    createPartnersEdges(transaction, 'Participates', networkQuery, networkActorsMapping),
  ]);

  return transaction.commit(2).return(`$${networkName}`).one();
}

async function updateNetwork(networkParams, existingNetwork) {
  const clusterWriters = require('./actor_cluster');
  const newNetworkQuery = _.get(networkParams, 'query', undefined);
  let networkQuery = {};

  if (_.isUndefined(newNetworkQuery) === true) {
    networkQuery = existingNetwork.query;
  } else {
    networkQuery = _.pickBy(newNetworkQuery, (val) => !(_.isUndefined(val)));
  }
  if (_.isEmpty(networkQuery) === true) {
    throw new codes.BadRequestError('Network "query" can\'t be empty.');
  }

  // We have to retrieve the clusters here before we delete the actor nodes
  const clusterQuery = `SELECT *,
    out('Includes').in('ActingAs').id as originalActorIDs
    FROM  ActorCluster
    WHERE out('PartOf').id=:networkID`;
  const existingClusters = await config.db.query(
    clusterQuery,
    { params: { networkID: existingNetwork.id } }
  );

  const networkName = recordName(existingNetwork.id, 'Network');
  const newNetworkAttrs = Object.assign({}, {
    name: _.get(networkParams, 'name', existingNetwork.name),
    settings: _.get(networkParams, 'settings', existingNetwork.settings),
    synopsis: _.get(networkParams, 'synopsis', existingNetwork.synopsis),
    query: networkQuery,
    created: existingNetwork.created,
    updated: moment().format('YYYY-MM-DD HH:mm:ss'),
  });

  const transaction = config.db.let(networkName, (t) => {
    t.update('Network')
      .set(newNetworkAttrs)
      .where({ '@rid': existingNetwork['@rid'] })
      .return('AFTER');
  });

  await deleteNetworkActors(transaction, existingNetwork);

  const networkActorsMapping = await Promise.join(
    createBuyerNodes(transaction, newNetworkAttrs.settings, networkQuery, networkName),
    createBidderNodes(transaction, newNetworkAttrs.settings, networkQuery, networkName),
    (buyerActorsMapping, bidderActorsMapping) =>
      Object.assign(buyerActorsMapping, bidderActorsMapping),
  );
  await Promise.all([
    createContractsEdges(transaction, newNetworkAttrs.settings, networkQuery, networkActorsMapping),
    createPartnersEdges(transaction, 'Awards', networkQuery, networkActorsMapping),
    createPartnersEdges(transaction, 'Participates', networkQuery, networkActorsMapping),
  ]);

  return transaction.commit(2).return(`$${networkName}`).one()
    .then((updatedNetwork) =>
      Promise.map(existingClusters, (existingCluster) => {
          const clusterActorsQuery = `SELECT * FROM NetworkActor
            WHERE out('PartOf').id=:networkID
            AND in('ActingAs').id in :actorIDs
          `
          return config.db.query(
            clusterActorsQuery,
            { params: { networkID: updatedNetwork.id, actorIDs: existingCluster.originalActorIDs}},
          ).then((newClusterActors) => {
            const newNodeIDs = _.map(newClusterActors, 'id');
            return clusterWriters.updateCluster(
              updatedNetwork.id,
              existingCluster.id,
              { nodes: newNodeIDs }
            );
          })
      })
      .then(() => updatedNetwork)
    );
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
  if (actorFilters.length) {
    filters.push(`(${_.join(_.compact(actorFilters), ' OR ')})`);
  }

  if (networkQuery.countries) {
    filters.push('xCountry in :countries');
  }
  if (networkQuery.years) {
    filters.push('xYear in :years');
  }
  if (networkQuery.cpvs) {
    filters.push("out('BidHasCPV').code in :cpvs");
  }
  return filters;
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
  const bidderNodesQuery = `SELECT bidder.name as label,
    bidder[@rid] as bidderRID,
    count(*) as numberOfWinningBids,
    sum(price.netAmountEur) as amountOfMoneyExchanged,
    bidder.address.country as country,
    median(out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      SELECT *, in('Participates') as bidder
      FROM Bid
      WHERE ${_.join(queryToBidFilters(networkQuery), ' AND ')}
      AND isWinning=true
      UNWIND bidder
    )
    WHERE bidder IS NOT NULL
    GROUP BY bidder;`;
  return config.db.query(bidderNodesQuery, { params: networkQuery })
    // I avoid using reduce here instead of map to run this in parralel
    .then((bidderNodes) => Promise.map(bidderNodes, (node) => {
      const nodeAttrs = _.pick(
        node,
        ['label', 'medianCompetition'],
      );
      nodeAttrs.id = uuidv4();
      nodeAttrs.type = 'bidder';
      nodeAttrs.active = true;
      nodeAttrs.countries = _.compact([node.country]);
      nodeAttrs.value = node[networkSettings.nodeSize];
      const partnerName = createNetworkActor(transaction, nodeAttrs, node.bidderRID, networkName);
      bidderActorMapping[node.bidderRID] = partnerName;
      return undefined;
    }))
    .then(() => bidderActorMapping);
}

function createBuyerNodes(transaction, networkSettings, networkQuery, networkName) {
  const buyerActorMapping = {};
  const buyerNodesQuery = `SELECT buyer.name as label,
    buyer[@rid] as buyerRID,
    count(*) as numberOfWinningBids,
    sum(price.netAmountEur) as amountOfMoneyExchanged,
    buyer.address.country as country,
    median(out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      SELECT *, in('Awards') as buyer
      FROM Bid
      WHERE ${_.join(queryToBidFilters(networkQuery), ' AND ')}
      AND isWinning=true
      UNWIND buyer
    )
    WHERE buyer IS NOT NULL
    GROUP BY buyer;`;
  return config.db.query(buyerNodesQuery, { params: networkQuery })
    .then((buyerNodes) => Promise.map(buyerNodes, (node) => {
      const nodeAttrs = _.pick(
        node,
        ['label', 'medianCompetition'],
      );
      nodeAttrs.id = uuidv4();
      nodeAttrs.type = 'buyer';
      nodeAttrs.active = true;
      nodeAttrs.countries = _.compact([node.country]);
      nodeAttrs.value = node[networkSettings.nodeSize];
      const partnerName = createNetworkActor(transaction, nodeAttrs, node.buyerRID, networkName);
      buyerActorMapping[node.buyerRID] = partnerName;
      return undefined;
    }))
    .then(() => buyerActorMapping);
}

function createNetworkActor(transaction, nodeAttrs, actorRID, networkName) {
  const partnerName = recordName(nodeAttrs.id, 'NetworkActor');
  transaction.let(partnerName, (t) => {
    t.create('vertex', 'NetworkActor')
      .set(nodeAttrs);
  });
  transaction.let(`${partnerName}PartOf`, (t) => {
    t.create('edge', 'PartOf')
      .from(`$${partnerName}`)
      .to(`$${networkName}`);
  });
  transaction.let(`ActingAs${partnerName}`, (t) => {
    t.create('edge', 'ActingAs')
      .from(actorRID)
      .to(`$${partnerName}`);
  });
  return partnerName;
}

function createContractsEdges(transaction, networkSettings, networkQuery, networkActorsMapping) {
  const contractsEdgesQuery = `SELECT buyerRID,
    bidderRID,
    bidRIDs.size() as numberOfWinningBids,
    bidSum as amountOfMoneyExchanged
    FROM (
      SELECT price,
      buyerRID,
      bidderRID,
      set(bidRID) as bidRIDs,
      sum(price.netAmountEur) as bidSum
      FROM (
        SELECT price,
        @rid as bidRID, 
        in('Participates') as bidderRID,
        in('Awards') as buyerRID
        FROM Bid
        WHERE ${_.join(queryToBidFilters(networkQuery), ' AND ')}
        AND isWinning=true
        UNWIND bidderRID, buyerRID
      )
      WHERE buyerRID IS NOT NULL
      AND bidderRID IS NOT NULL
      GROUP BY [buyerRID, bidderRID]
    );`;
  return config.db.query(contractsEdgesQuery, { params: networkQuery })
    .then((contractsEdges) => Promise.map(contractsEdges, (edge) => {
      const edgeAttrs = {
        uuid: uuidv4(),
        value: edge[networkSettings.edgeSize],
        active: true,
      };
      const fromName = networkActorsMapping[edge.buyerRID];
      const toName = networkActorsMapping[edge.bidderRID];
      return createNetworkEdge(transaction, 'Contracts', edgeAttrs, fromName, toName);
    }));
}

function createPartnersEdges(transaction, edgeToBidClass, networkQuery, networkActorsMapping) {
  const partnersEdgesQuery = `SELECT actorRID,
    partnerRID,
    sharedBidRIDs.size() as value
    FROM (
      SELECT actorRID,
      partnerRID,
      set(bidRID) as sharedBidRIDs
      FROM (
        SELECT bidRID,
        actorRID,
        partnerRID,
        set(actorRID, partnerRID) as pair
        FROM (
          SELECT @rid as bidRID,
          in('${edgeToBidClass}') as actorRID,
          in('${edgeToBidClass}') as partnerRID
          FROM Bid
          WHERE ${_.join(queryToBidFilters(networkQuery), ' AND ')}
          AND isWinning=true
          AND in('${edgeToBidClass}').size() > 1
          UNWIND actorRID, partnerRID
        ) WHERE actorRID != partnerRID
      ) GROUP BY pair
    )`;
  return config.db.query(partnersEdgesQuery, { params: networkQuery })
    .then((partnersEdges) => Promise.map(partnersEdges, (edge) => {
      const edgeAttrs = {
        uuid: uuidv4(),
        value: edge.value,
        active: true,
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

function deleteNetworkActors(transaction, existingNetwork) {
  return config.db.select().from('NetworkActor')
    .where({
      "out('PartOf').id": existingNetwork.id,
      "@class": 'NetworkActor',
    })
    .all()
    .then((networkActors) => Promise.map(networkActors, (networkActor) => {
      const deleteActorName = recordName(networkActor.id, 'delete');

      transaction.let(deleteActorName, (t) =>
        t.delete('vertex', 'NetworkActor')
          .where({ '@rid': networkActor['@rid'] }));
    }));
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
  queryToBidFilters,
  recordName,
  updateNetwork,
};

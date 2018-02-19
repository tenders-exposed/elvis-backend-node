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
    throw codes.BadRequest('Network "query" can\'t be empty.');
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
    filters.push("out('AppliedTo').in('Comprises').out('HasCPV').code in :cpvs");
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

function settingsToValueQuery(sizeSetting) {
  let value;
  if (sizeSetting === 'numberOfWinningBids') {
    value = 'set(@rid).size()';
  } else if (sizeSetting === 'amountOfMoneyExchanged') {
    value = 'sum(price.netAmountEur)';
  }
  return value;
}

function createBidderNodes(transaction, networkSettings, networkQuery, networkName) {
  const bidderActorMapping = {};
  const valueQuery = settingsToValueQuery(networkSettings.nodeSize);
  const bidderNodesQuery = `SELECT bidder.name as label,
    bidder[@rid] as bidderRID,
    ${valueQuery} as value,
    median(out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      SELECT *, in('Participates') as bidder
      FROM Bid
      WHERE ${_.join(queryToBidFilters(networkQuery), ' AND ')}
      UNWIND bidder
    )
    WHERE bidder IS NOT NULL
    GROUP BY bidder;`;
  return config.db.query(bidderNodesQuery, { params: networkQuery })
    // I avoid using reduce here instead of map to run this in parralel
    .then((bidderNodes) => Promise.map(bidderNodes, (node) => {
      const nodeAttrs = _.pick(
        node,
        ['label', 'value', 'medianCompetition'],
      );
      nodeAttrs.type = 'bidder';
      nodeAttrs.active = true;
      nodeAttrs.id = uuidv4();
      const partnerName = createNetworkActor(transaction, nodeAttrs, node.bidderRID, networkName);
      bidderActorMapping[node.bidderRID] = partnerName;
      return undefined;
    }))
    .then(() => bidderActorMapping);
}

function createBuyerNodes(transaction, networkSettings, networkQuery, networkName) {
  const buyerActorMapping = {};
  const valueQuery = settingsToValueQuery(networkSettings.nodeSize);
  const buyerNodesQuery = `SELECT buyer.name as label,
    buyer[@rid] as buyerRID,
    ${valueQuery} as value,
    buyer.address.country as country,
    median(out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      SELECT *, in('Awards') as buyer
      FROM Bid
      WHERE ${_.join(queryToBidFilters(networkQuery), ' AND ')}
      UNWIND buyer
    )
    WHERE buyer IS NOT NULL
    GROUP BY buyer;`;
  return config.db.query(buyerNodesQuery, { params: networkQuery })
    .then((buyerNodes) => Promise.map(buyerNodes, (node) => {
      const nodeAttrs = _.pick(
        node,
        ['label', 'value', 'medianCompetition', 'country'],
      );
      nodeAttrs.type = 'buyer';
      nodeAttrs.active = true;
      nodeAttrs.id = uuidv4();
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
  const valueQuery = settingsToValueQuery(networkSettings.edgeSize);
  const contractsEdgesQuery = `SELECT buyer[@rid] as buyerRID,
    bidder[@rid] as bidderRID,
    ${valueQuery} as value
    FROM (
      SELECT *, in('Participates') as bidder,
      in('Awards') as buyer
      FROM Bid
      WHERE ${_.join(queryToBidFilters(networkQuery), ' AND ')}
      UNWIND bidder, buyer
    )
    WHERE buyer IS NOT NULL
    AND bidder IS NOT NULL
    GROUP BY [buyer, bidder];`;
  return config.db.query(contractsEdgesQuery, { params: networkQuery })
    .then((contractsEdges) => Promise.map(contractsEdges, (edge) => {
      const edgeAttrs = {
        value: edge.value,
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
    set(bidRID).size() as value
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
        AND in('${edgeToBidClass}').size() > 1
        UNWIND actorRID, partnerRID
      ) WHERE actorRID != partnerRID
    ) GROUP BY pair;`;
  return config.db.query(partnersEdgesQuery, { params: networkQuery })
    .then((partnersEdges) => Promise.map(partnersEdges, (edge) => {
      const edgeAttrs = {
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

async function createCluster(networkID, clusterParams) {
  const edgeToBidClass = clusterParams.type === 'buyer' ? 'Awards' : 'Participates';
  const network = await config.db.select()
    .from('Network')
    .where({ id: networkID })
    .one();
  const actorsIDsQuery = `SELECT *,
    in('ActingAs').id
    FROM NetworkActor
    WHERE id in :nodes
    AND type=:type;`;
  const actorIDs = await config.db.query(
    actorsIDsQuery,
    { params: { nodes: clusterParams.nodes, type: clusterParams.type } },
  ).then((networkActors) => _.map(networkActors, (networkActor) => {
    if (networkActor.active === false) {
      throw codes.BadRequest(`Node with ID ${networkActor.id} can't be used in a cluster because it is deactivated.`);
    }
    return networkActor.in[0];
  }));

  const clusterQuery = `SELECT count(*) as value,
    median(out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      SELECT *
      FROM Bid
      WHERE ${_.join(queryToBidFilters(network.query), ' AND ')}
      AND in('${edgeToBidClass}').id in :actorIDs
    );`;
  const clusterAttrs = await config.db.query(
    clusterQuery,
    { params: Object.assign(network.query, { actorIDs }) },
  ).then((results) => _.pick(results[0], ['value', 'medianCompetition']));
  Object.assign(clusterAttrs, {
    id: uuidv4(),
    label: clusterParams.label,
    type: clusterParams.type,
    active: true,
  });

  const clusterName = recordName(clusterAttrs.id, 'ActorCluster');
  const transaction = config.db.let(clusterName, (t) => {
    t.create('vertex', 'ActorCluster')
      .set(clusterAttrs);
  });
  transaction.let(`${clusterName}PartOf`, (t) => {
    t.create('edge', 'PartOf')
      .from(`$${clusterName}`)
      .to(network['@rid']);
  });

  return Promise.all([
    createClusterPartnersEdges(transaction, edgeToBidClass, network, actorIDs, clusterName),
    createClusterContractsEdges(transaction, edgeToBidClass, network, actorIDs, clusterName),
    createClusterIncludesEdges(transaction, network, clusterParams.nodes, clusterName),
  ])
    .then(() => Promise.map(clusterParams.nodes, (nodeID) =>
      deactivateNetworkActor(transaction, network, nodeID)))
    .then(() => transaction.commit(2).return(`$${clusterName}`).one())
    .then(() => network);
}

function createClusterPartnersEdges(transaction, edgeToBidClass, network, actorIDs, clusterName) {
  const clusterPartnersQuery = `SELECT outsider[0] as clusterPartnerID,
    sum(bidsCount) as value
    FROM (
      SELECT difference(pairIDs, :actorIDs) as outsider,
      set(bidRID).size() as bidsCount
      FROM (
        SELECT bidRID,
        set(actor.id, partner.id) as pairIDs,
        set(actor, partner) as pairRIDs
        FROM (
          SELECT @rid as bidRID,
          in('${edgeToBidClass}') as actor,
          in('${edgeToBidClass}') as partner
          FROM Bid
          WHERE ${_.join(queryToBidFilters(network.query), ' AND ')}
          AND in('${edgeToBidClass}').id in :actorIDs
          AND in('${edgeToBidClass}').size() > 1
          UNWIND actor, partner
        ) WHERE actor != partner
      ) WHERE difference(pairIDs, :actorIDs).size() > 0
      GROUP BY pairRIDs
    ) GROUP BY outsider;`;
  return config.db.query(
    clusterPartnersQuery,
    { params: Object.assign(network.query, { actorIDs }) },
  ).then((partnersEdges) => Promise.map(partnersEdges, (edge) => {
    const edgeAttrs = {
      value: edge.value,
      active: true,
    };
    return createClusterActorEdge(transaction, 'Partners', edgeAttrs, clusterName, edge.clusterPartnerID, network.id);
  }));
}

function createClusterContractsEdges(transaction, edgeToBidClass, network, actorIDs, clusterName) {
  const valueQuery = settingsToValueQuery(network.settings.edgeSize);
  const contractorEdge = edgeToBidClass === 'Awards' ? 'Participates' : 'Awards';
  const clusterContractsQuery = `SELECT contractor.id as contractorID,
    ${valueQuery} as value
    FROM (
      SELECT @rid as bidRID,
      in('${contractorEdge}') as contractor,
      in('${edgeToBidClass}') as clusterActor
      FROM Bid
      WHERE ${_.join(queryToBidFilters(network.query), ' AND ')}
      AND in('${edgeToBidClass}').id in :actorIDs
      UNWIND contractor, clusterActor
    ) WHERE contractor IS NOT NULL
    AND clusterActor IS NOT NULL
    GROUP BY contractor;`;
  return config.db.query(
    clusterContractsQuery,
    { params: Object.assign(network.query, { actorIDs }) },
  ).then((contractsEdges) => Promise.map(contractsEdges, (edge) => {
    const edgeAttrs = {
      value: edge.value,
      active: true,
    };
    return createClusterActorEdge(transaction, 'contracts', edgeAttrs, clusterName, edge.contractorID, network.id);
  }));
}

function createClusterActorEdge(transaction, edgeClass, edgeAttrs, clusterName, actorID, networkID) {
  return config.db.select()
    .from('NetworkActor').where({
      "out('PartOf').id": networkID,
      "in('ActingAs').id": actorID,
    })
    .one()
    .then((partnerNode) => {
      const partnerName = recordName(actorID, 'NetworkActor');
      const edgeName = `${clusterName}${edgeClass}${partnerName}`;
      transaction.let(edgeName, (t) => {
        t.create('edge', edgeClass)
          .from(`$${clusterName}`)
          .to(partnerNode['@rid'])
          .set(edgeAttrs);
      });
      return edgeName;
    });
}

function createClusterIncludesEdges(transaction, network, nodeIDs, clusterName) {
  return Promise.map(nodeIDs, (nodeID) =>
    config.db.select()
      .from('NetworkActor')
      .where({ id: nodeID })
      .one()
      .then((networkActor) => {
        const edgeName = `${clusterName}Includes${recordName(nodeID, 'NetworkActor')}`;
        transaction.let(edgeName, (t) => {
          t.create('edge', 'Includes')
            .from(`$${clusterName}`)
            .to(networkActor['@rid']);
        });
        return edgeName;
      }));
}

function deactivateNetworkActor(transaction, network, networkActorID) {
  const actorName = recordName(networkActorID, 'NetworkActor');
  transaction.let(actorName, (t) => {
    t.update('NetworkActor')
      .set({ active: false })
      .where({ id: networkActorID })
      .return('AFTER');
  });
  return Promise.all([
    deactivateNetworkActorEdges(transaction, networkActorID, 'Contracts'),
    deactivateNetworkActorEdges(transaction, networkActorID, 'Partners'),
  ]);
}

function deactivateNetworkActorEdges(transaction, networkActorID, edgeClass) {
  const actorEdgesQuery = `SELECT unionall(
    inE('${edgeClass}'),
    outE('${edgeClass}')
  ) as edges
  FROM NetworkActor
  WHERE id=:networkActorID;`;
  return config.db.query(actorEdgesQuery, { params: { networkActorID } })
    .then((results) => results[0].edges)
    .then((edges) => Promise.map(edges, (edgeRID) => {
      const edgeName = recordName(uuidv4(), edgeClass);
      transaction.let(edgeName, (t) => {
        t.update(edgeClass)
          .set({ active: false })
          .where({ '@rid': edgeRID })
          .return('AFTER');
      });
      return edgeName;
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
  createCluster,
  createClusterPartnersEdges,
  createClusterActorEdge,
  createClusterContractsEdges,
  createClusterIncludesEdges,
  deactivateNetworkActor,
  deactivateNetworkActorEdges,
};

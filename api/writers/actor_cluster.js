'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuidv4 = require('uuid/v4');

const codes = require('../helpers/codes');
const config = require('../../config/default');
const networkWriters = require('./network');

async function createCluster(networkID, clusterParams) {
  const edgeToBidClass = clusterParams.type === 'buyer' ? 'Awards' : 'Participates';
  const network = await config.db.select()
    .from('Network')
    .where({ id: networkID })
    .one();
  if (_.isUndefined(network) === true) {
    throw codes.NotFound(`Network with \`id\` ${networkID} was not found.`);
  }
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
      throw codes.BadRequest(`Node with \`id\` ${networkActor.id} can't be used in a cluster because it is deactivated.`);
    }
    return networkActor.in[0];
  }));

  if (_.isEmpty(actorIDs) === true) {
    throw codes.BadRequest('No nodes with `id` and `type` you provided were found.');
  }
  const clusterQuery = `SELECT count(*) as value,
    median(out('AppliedTo').bidsCount) as medianCompetition
    FROM (
      SELECT *
      FROM Bid
      WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
      AND in('${edgeToBidClass}').id in :actorIDs
      AND isWinning=true
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

  const clusterName = networkWriters.recordName(clusterAttrs.id, 'ActorCluster');
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
    createPartnersEdges(transaction, edgeToBidClass, network, actorIDs, clusterName),
    createContractsEdges(transaction, edgeToBidClass, network, actorIDs, clusterName),
    createIncludesEdges(transaction, network, clusterParams.nodes, clusterName),
  ])
    .then(() => Promise.map(clusterParams.nodes, (nodeID) =>
      deactivateNetworkActor(transaction, network, nodeID)))
    .then(() => transaction.commit(2)
      .return(`$${clusterName}`)
      .one());
}

function createPartnersEdges(transaction, edgeToBidClass, network, actorIDs, clusterName) {
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
          WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
          AND in('${edgeToBidClass}').id in :actorIDs
          AND in('${edgeToBidClass}').size() > 1
          AND isWinning=true
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
    return createNetworkEdge(transaction, 'Partners', edgeAttrs, clusterName, edge.clusterPartnerID, network.id);
  }));
}

function createContractsEdges(transaction, edgeToBidClass, network, actorIDs, clusterName) {
  const valueQuery = networkWriters.settingsToValueQuery(network.settings.edgeSize);
  const contractorEdge = edgeToBidClass === 'Awards' ? 'Participates' : 'Awards';
  const clusterContractsQuery = `SELECT contractor.id as contractorID,
    ${valueQuery} as value
    FROM (
      SELECT @rid as bidRID,
      in('${contractorEdge}') as contractor,
      in('${edgeToBidClass}') as clusterActor
      FROM Bid
      WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
      AND in('${edgeToBidClass}').id in :actorIDs
      AND isWinning=true
      UNWIND contractor
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
    return createNetworkEdge(transaction, 'contracts', edgeAttrs, clusterName, edge.contractorID, network.id);
  }));
}

function createNetworkEdge(transaction, edgeClass, edgeAttrs, clusterName, actorID, networkID) {
  return config.db.select()
    .from('NetworkActor').where({
      "out('PartOf').id": networkID,
      "in('ActingAs').id": actorID,
    })
    .one()
    .then((partnerNode) => {
      const partnerName = networkWriters.recordName(actorID, 'NetworkActor');
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

function createIncludesEdges(transaction, network, nodeIDs, clusterName) {
  return Promise.map(nodeIDs, (nodeID) =>
    config.db.select()
      .from('NetworkActor')
      .where({ id: nodeID })
      .one()
      .then((networkActor) => {
        const edgeName = `${clusterName}Includes${networkWriters.recordName(nodeID, 'NetworkActor')}`;
        transaction.let(edgeName, (t) => {
          t.create('edge', 'Includes')
            .from(`$${clusterName}`)
            .to(networkActor['@rid']);
        });
        return edgeName;
      }));
}

function deactivateNetworkActor(transaction, network, networkActorID) {
  const actorName = networkWriters.recordName(networkActorID, 'NetworkActor');
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
      const edgeName = networkWriters.recordName(uuidv4(), edgeClass);
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
  createCluster,
  createPartnersEdges,
  createContractsEdges,
  createNetworkEdge,
  createIncludesEdges,
  deactivateNetworkActor,
  deactivateNetworkActorEdges,
};

'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuidv4 = require('uuid/v4');

const codes = require('../helpers/codes');
const config = require('../../config/default');
const networkWriters = require('./network');

async function createCluster(networkID, clusterParams) {
  const edgeToBidClass = clusterParams.type === 'buyer' ? 'Awards' : 'Participates';
  const network = await retrieveNetwork(networkID);
  const actorIDs = await retrieveActorIDs(clusterParams.nodes, clusterParams.type);

  const calcuatedAttrs = await calculateCluster(edgeToBidClass, network, actorIDs);
  const clusterAttrs = {
    id: uuidv4(),
    label: clusterParams.label,
    type: clusterParams.type,
    active: true,
    countries: _.compact(_.uniq(calcuatedAttrs.countries)),
    value: calcuatedAttrs[network.settings.nodeSize],
    medianCompetition: calcuatedAttrs.medianCompetition,
  };
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
    .then(() => Promise.map(clusterParams.nodes, (networkActorID) =>
      updateClusterActor(transaction, network, networkActorID, false)))
    .then(() => transaction.commit(2)
      .return(`$${clusterName}`)
      .one());
}

async function updateCluster(networkID, clusterID, clusterParams) {
  const network = await retrieveNetwork(networkID);
  const cluster = await retrieveCluster(networkID, clusterID);
  const clusterAttrs = {
    id: cluster.id,
    type: clusterParams.type || cluster.type,
    label: clusterParams.label || cluster.label,
  };
  const edgeToBidClass = clusterAttrs.type === 'buyer' ? 'Awards' : 'Participates';
  const actorIDs = await retrieveActorIDs(
    clusterParams.nodes || cluster.nodes,
    clusterAttrs.type,
    clusterAttrs.id,
  );

  if (clusterParams.type || clusterParams.nodes) {
    const calcuatedAttrs = await calculateCluster(edgeToBidClass, network, actorIDs);
    Object.assign(clusterAttrs, {
      value: calcuatedAttrs[network.settings.nodeSize],
      medianCompetition: calcuatedAttrs.medianCompetition,
    });
  }

  const clusterName = networkWriters.recordName(cluster.id, 'ActorCluster');
  const transaction = config.db.let(clusterName, (t) => {
    t.update('ActorCluster')
      .set(clusterAttrs)
      .where({ '@rid': cluster['@rid'] })
      .return('AFTER');
  });
  if (clusterParams.nodes) {
    const removedNodes = _.difference(cluster.nodes, clusterParams.nodes);
    if (removedNodes.length) {
      await Promise.map(removedNodes, (networkActorID) =>
        updateClusterActor(transaction, network, networkActorID, true));
    }
  }

  if (clusterParams.type || clusterParams.nodes) {
    await removeClusterEdges(transaction, cluster);
    await Promise.all([
      createPartnersEdges(transaction, edgeToBidClass, network, actorIDs, clusterName),
      createContractsEdges(transaction, edgeToBidClass, network, actorIDs, clusterName),
      createIncludesEdges(transaction, network, clusterParams.nodes, clusterName),
    ])
      .then(() => Promise.map(clusterParams.nodes, (networkActorID) =>
        updateClusterActor(transaction, network, networkActorID, false)));
  }

  return transaction.commit(2).return(`$${clusterName}`).one();
}

async function deleteCluster(networkID, clusterID) {
  const network = await retrieveNetwork(networkID);
  const cluster = await retrieveCluster(networkID, clusterID);
  const clusterName = networkWriters.recordName(cluster.id, 'ActorCluster');
  const transaction = config.db.let(clusterName, (t) => {
    t.delete('vertex', 'ActorCluster')
      .where({ '@rid': cluster['@rid'] });
  });
  await Promise.map(cluster.nodes, (networkActorID) =>
    updateClusterActor(transaction, network, networkActorID, true));
  return transaction.commit(2).return(`$${clusterName}`).one();
}

function calculateCluster(edgeToBidClass, network, actorIDs) {
  const clusterQuery = `SELECT
    count(*) as numberOfWinningBids,
    sum(price.netAmountEur) as amountOfMoneyExchanged,
    median(out('AppliedTo').bidsCount) as medianCompetition,
    unionall(in('${edgeToBidClass}').address.country) as countries
    FROM Bid
    WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
    AND in('${edgeToBidClass}').id in :actorIDs
    AND isWinning=true;`;
  return config.db.query(
    clusterQuery,
    { params: Object.assign({}, network.query, { actorIDs }) },
  ).then((results) => results[0]);
}

function retrieveActorIDs(networkActorIDs, clusterType, clusterID) {
  const actorIDsQuery = `SELECT *,
    in('ActingAs').id as actorIDs,
    in('Includes').id as clusterIDs
    FROM NetworkActor
    WHERE id in :nodes
    AND type=:type;`;
  return config.db.query(
    actorIDsQuery,
    { params: { nodes: networkActorIDs, type: clusterType } },
  )
    .then((networkActors) => {
      if (_.isEmpty(networkActors) === true) {
        throw new codes.BadRequestError('No nodes with `id` and `type` you provided were found.');
      }
      return _.map(networkActors, (networkActor) => {
        if (networkActor.active === false) {
          if (_.isUndefined(clusterID) || !_.includes(networkActor.clusterIDs, clusterID)) {
            throw new codes.BadRequestError(`Node with \`id\` ${networkActor.id} can't be used because it is already part of another cluster.`);
          }
        }
        return networkActor.actorIDs[0];
      });
    });
}

function retrieveCluster(networkID, clusterID) {
  const clusterQuery = `SELECT *,
    out('Includes').id as nodes
    FROM  ActorCluster
    WHERE id=:clusterID
    AND out('PartOf').id=:networkID`;
  return config.db.query(
    clusterQuery,
    { params: { clusterID, networkID } },
  ).then((result) => {
    if (_.isEmpty(result) === true) {
      throw new codes.NotFoundError(`Cluster with \`id\` ${clusterID} was not found in the network with id ${networkID}}.`);
    }
    return result[0];
  });
}

function retrieveNetwork(networkID) {
  return config.db.select()
    .from('Network')
    .where({ id: networkID })
    .one()
    .then((network) => {
      if (_.isUndefined(network) === true) {
        throw new codes.NotFoundError(`Network with \`id\` ${networkID} was not found.`);
      }
      return network;
    });
}

function createPartnersEdges(transaction, edgeToBidClass, network, actorIDs, clusterName) {
  const clusterPartnersQuery = `SELECT clusterPartnerID,
    clusterPartnerBidIDs.size() as value
    FROM (
      SELECT outsider[0] as clusterPartnerID,
      set(bidIDs) as clusterPartnerBidIDs
      FROM (
        SELECT difference(pairIDs, :actorIDs) as outsider,
        set(bidID) as bidIDs
        FROM (
          SELECT bidID,
          set(actor.id, partner.id) as pairIDs,
          set(actor, partner) as pairRIDs
          FROM (
            SELECT id as bidID,
            in('${edgeToBidClass}') as actor,
            in('${edgeToBidClass}') as partner
            FROM Bid
            WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
            AND in('${edgeToBidClass}').id in :actorIDs
            AND in('${edgeToBidClass}').size() > 1
            AND isWinning=true
            UNWIND actor, partner
          ) WHERE actor != partner
        ) WHERE difference(pairIDs, :actorIDs).size() = 1
        GROUP BY pairRIDs
      ) GROUP BY outsider
    );`;
  return config.db.query(
    clusterPartnersQuery,
    { params: Object.assign({}, network.query, { actorIDs }) },
  ).then((partnersEdges) => {
    const partnerIDs = _.map(partnersEdges, 'clusterPartnerID');
    return Promise.map(partnersEdges, (edge) =>
      retrieveNetworkActor(edge.clusterPartnerID, network.id)
        .then((partnerNode) =>
          createPartnersEdge(transaction, network, edge.value, partnerNode, clusterName)))
      .then(() => {
        // Calculate Partners edges with other clusters in the network
        const partnerClusterActorsQuery = `SELECT in('Includes')[0].id as partnerClusterID,
        set(in('ActingAs').id) as partnerClusterActorIDs
        FROM (
          SELECT * FROM NetworkActor WHERE out('PartOf').id = :networkID
          AND in('ActingAs').id in :partnerIDs
          AND in('Includes').size() > 0
        ) GROUP BY in('Includes');`;
        return config.db.query(
          partnerClusterActorsQuery,
          { params: { networkID: network.id, partnerIDs } },
        );
      })
      .then((results) =>
        Promise.map(results, (result) => {
          const contractorClusterEdgeQuery = `SELECT count(*) as value
            FROM Bid
            WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
            AND in('${edgeToBidClass}').id in :partnerClusterActorIDs
            AND in('${edgeToBidClass}').id in :actorIDs
            AND isWinning=true;`;
          const queryParams = Object.assign(
            {},
            network.query,
            {
              actorIDs,
              partnerClusterActorIDs: result.partnerClusterActorIDs,
            },
          );
          return Promise.join(
            retrieveCluster(network.id, result.partnerClusterID),
            config.db.query(
              contractorClusterEdgeQuery,
              { params: queryParams },
            ),
            (contractorCluster, edgeResult) =>
              createPartnersEdge(transaction, network, edgeResult[0].value, contractorCluster, clusterName), // eslint-disable-line max-len
          );
        }));
  });
}

function createContractsEdges(transaction, edgeToBidClass, network, actorIDs, clusterName) {
  const contractorEdge = edgeToBidClass === 'Awards' ? 'Participates' : 'Awards';
  const clusterContractsQuery = `SELECT contractorID,
    bidIDs.size() as numberOfWinningBids,
    bidSum as amountOfMoneyExchanged
    FROM (
      SELECT contractor.id as contractorID,
      set(id) as bidIDs,
      sum(price.netAmountEur) as bidSum
      FROM (
        SELECT *,
        in('${contractorEdge}') as contractor,
        in('${edgeToBidClass}') as clusterActor
        FROM Bid
        WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
        AND in('${edgeToBidClass}').id in :actorIDs
        AND isWinning=true
        UNWIND contractor
      ) WHERE contractor IS NOT NULL
      AND clusterActor IS NOT NULL
      GROUP BY contractor
    );`;
  return config.db.query(
    clusterContractsQuery,
    { params: Object.assign({}, network.query, { actorIDs }) },
  ).then((contractsEdges) => {
    const contractorIDs = _.map(contractsEdges, 'contractorID');
    return Promise.map(contractsEdges, (edge) =>
      retrieveNetworkActor(edge.contractorID, network.id)
        .then((contractorNode) => {
          const edgeValue = edge[network.settings.edgeSize];
          return createContractsEdge(transaction, network, edgeValue, contractorNode, clusterName);
        }))
      .then(() => {
        // Calculate Contracts edges with other clusters in the network
        const contractorClusterActorsQuery = `SELECT in('Includes')[0].id as contractorClusterID,
        set(in('ActingAs').id) as contractorClusterActorIDs
        FROM (
          SELECT * FROM NetworkActor WHERE out('PartOf').id = :networkID
          AND in('ActingAs').id in :contractorIDs
          AND in('Includes').size() > 0
        ) GROUP BY in('Includes');`;
        return config.db.query(
          contractorClusterActorsQuery,
          { params: { networkID: network.id, contractorIDs } },
        );
      })
      .then((results) =>
        Promise.map(results, (result) => {
          const contractorClusterEdgeQuery = `SELECT
          count(*) as numberOfWinningBids,
          sum(price.netAmountEur) as amountOfMoneyExchanged
          FROM Bid
          WHERE ${_.join(networkWriters.queryToBidFilters(network.query), ' AND ')}
          AND in('${contractorEdge}').id in :contractorClusterIDs
          AND in('${edgeToBidClass}').id in :actorIDs
          AND isWinning=true;`;
          const queryParams = Object.assign(
            {},
            network.query,
            {
              actorIDs,
              contractorClusterIDs: result.contractorClusterActorIDs,
            },
          );
          return Promise.join(
            retrieveCluster(network.id, result.contractorClusterID),
            config.db.query(
              contractorClusterEdgeQuery,
              { params: queryParams },
            ),
            (contractorCluster, edgeResult) => {
              const edgeValue = edgeResult[0][network.settings.edgeSize];
              return createContractsEdge(transaction, network, edgeValue, contractorCluster, clusterName); // eslint-disable-line max-len
            },
          );
        }));
  });
}

function createContractsEdge(transaction, network, edgeValue, contractorNode, clusterName) {
  const edgeAttrs = {
    uuid: uuidv4(),
    value: edgeValue,
    active: true,
  };
  const partnerName = networkWriters.recordName(contractorNode.id, contractorNode['@class']);
  const edgeName = `${clusterName}contracts${partnerName}`;
  if (contractorNode.active === false) {
    edgeAttrs.active = false;
  }
  if (contractorNode.type === 'bidder') {
    transaction.let(edgeName, (t) => {
      t.create('edge', 'Contracts')
        .from(`$${clusterName}`)
        .to(contractorNode['@rid'])
        .set(edgeAttrs);
    });
  } else {
    transaction.let(edgeName, (t) => {
      t.create('edge', 'Contracts')
        .from(contractorNode['@rid'])
        .to(`$${clusterName}`)
        .set(edgeAttrs);
    });
  }
  return edgeName;
}

function createPartnersEdge(transaction, network, edgeValue, partnerNode, clusterName) {
  const edgeAttrs = {
    uuid: uuidv4(),
    value: edgeValue,
    active: true,
  };
  const partnerName = networkWriters.recordName(partnerNode.id, partnerNode['@class']);
  const edgeName = `${clusterName}contracts${partnerName}`;
  if (partnerNode.active === false) {
    edgeAttrs.active = false;
  }
  transaction.let(edgeName, (t) => {
    t.create('edge', 'Partners')
      .from(partnerNode['@rid'])
      .to(`$${clusterName}`)
      .set(edgeAttrs);
  });
  return edgeName;
}

function retrieveNetworkActor(actorID, networkID) {
  return config.db.select()
    .from('NetworkActor')
    .where({
      "out('PartOf').id": networkID,
      "in('ActingAs').id": actorID,
    })
    .one();
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

function updateClusterActor(transaction, network, networkActorID, active) {
  const actorName = networkWriters.recordName(networkActorID, 'NetworkActor');
  transaction.let(actorName, (t) => {
    t.update('NetworkActor')
      .set({ active })
      .where({ id: networkActorID })
      .return('AFTER');
  });
  return Promise.all([
    updateClusterActorEdges(transaction, networkActorID, 'Contracts', active),
    updateClusterActorEdges(transaction, networkActorID, 'Partners', active),
  ]);
}

function updateClusterActorEdges(transaction, networkActorID, edgeClass, active) {
  const inEdgesQuery = `SELECT *
    FROM (
      SELECT expand(inE('${edgeClass}'))
      FROM NetworkActor
      WHERE id=:networkActorID
    ) WHERE out.active = true
    OR :networkActorID IN out.in('Includes').out('Includes').id;`;
  const outEdgesQuery = `SELECT *
  FROM (
    SELECT expand(outE('${edgeClass}'))
    FROM NetworkActor
    WHERE id=:networkActorID
  ) WHERE in.active = true
  OR :networkActorID IN in.in('Includes').out('Includes').id;`;
  return Promise.join(
    config.db.query(inEdgesQuery, { params: { networkActorID } }),
    config.db.query(outEdgesQuery, { params: { networkActorID } }),
    (inEdges, outEdges) => Promise.map(_.concat(inEdges, outEdges), (edge) => {
      const edgeName = networkWriters.recordName(uuidv4(), edgeClass);
      transaction.let(edgeName, (t) => {
        t.update(edgeClass)
          .set({ active })
          .where({ uuid: edge.uuid })
          .return('AFTER');
      });
      return edgeName;
    }),
  );
}

function removeClusterEdges(transaction, cluster) {
  const edgesQuery = `SELECT expand(unionall(
    bothE('Partners'),
    bothE('Contracts'),
    bothE('Includes')
  )) AS edges
  FROM ActorCluster
  WHERE id=:clusterID
  UNWIND edges`;
  return config.db.query(edgesQuery, { params: { clusterID: cluster.id } })
    .then((edges) => Promise.map(edges, (edge) => {
      const edgeName = `delete${networkWriters.recordName(uuidv4(), 'NetworkEdge')}`;
      transaction.let(edgeName, (t) => {
        t.delete('edge', edge['@class'])
          .where({ '@rid': edge['@rid'] });
      });
      return edgeName;
    }));
}

module.exports = {
  createCluster,
  updateCluster,
  deleteCluster,
  calculateCluster,
  createPartnersEdges,
  createContractsEdges,
  createIncludesEdges,
  retrieveNetwork,
  retrieveCluster,
  retrieveNetworkActor,
  retrieveActorIDs,
  updateClusterActor,
  updateClusterActorEdges,
  removeClusterEdges,
};

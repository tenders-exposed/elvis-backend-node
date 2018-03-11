'use strict';

const _ = require('lodash');
const config = require('../../config/default');

function formatActor(actor) {
  const fields = ['name', 'id'];
  if (actor['@class'] === 'Buyer') {
    fields.push('country');
  }
  const formattedActor = _.pick(actor, fields);
  formattedActor.type = _.toLower(actor['@class']);
  return formattedActor;
}

function formatActorWithNode(network, actor) {
  return config.db.select("*, in('Includes').id as clusterIDs")
    .from('NetworkActor')
    .where({
      "out('PartOf').id": network.id,
      "in('ActingAs').id": actor.id,
    })
    .one()
    .then((networkActor) => {
      const formattedActor = formatActor(actor);
      formattedActor.nodeID = networkActor.id;
      if (networkActor.active === false) {
        formattedActor.nodeID = networkActor.clusterIDs[0];
      }
      return formattedActor;
    });
}

module.exports = {
  formatActor,
  formatActorWithNode,
};

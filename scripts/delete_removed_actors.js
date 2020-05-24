/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');

const config = require('../config/default');
const helpers = require('./helpers');

function recordName(id, className) {
  return `${className.toLowerCase()}${id.replace(/-/g, '')}`;
}

function deleteRemovedActors() {
  const removedBuyersQuery = `SELECT * FROM Buyer WHERE out('Awards').size() == 0`
  const removedBiddersQuery = `SELECT * FROM Bidder WHERE out('Participates').size() == 0`
  return config.db.query(removedBuyersQuery)
    .then((removedBuyers) => Promise.map(removedBuyers, (removedBuyer) =>
      deleteRemovedActor(removedBuyer, 'Buyer')))
    .then((deletedBuyers) => {
      console.log(`Deleted ${deletedBuyers.length} buyers`);
    })
      .then(() => config.db.query(removedBiddersQuery))
      .then((removedBidders) => Promise.map(removedBidders, (removedBidder) => 
        deleteRemovedActor(removedBidder, 'Bidder')))
      .then((deletedBidders) => {
        console.log(`Deleted ${deletedBidders.length} bidders`);
        process.exit();
      })
      .catch((err) => {
        console.error(err);
        process.exit(-1);
      });
}

async function deleteRemovedActor(actor, actorClass) {
  const actorName = recordName(actor.id, actorClass);

  const transaction = config.db.let(actorName, (t) =>
    t.delete('vertex', actorClass)
      .where({ '@rid': actor['@rid'] }));
  return transaction.commit(2).return(`$${actorName}`).one()
    .catch((err) => {
      console.log(err);
      throw err;
    });
}

deleteRemovedActors();

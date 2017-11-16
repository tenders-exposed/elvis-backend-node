'use strict';

const Promise = require('bluebird');
const config = require('../config');

function dropDB() {
  // Order counts. Delete subclasses first
  const dbClasses = [
    'Contracts',
    'Partners',
    'Incorporates',
    'Includes',
    'ActingAs',
    'NetworkEdge',
    'ActorConsortium',
    'ActorCluster',
    'NetworkActor',
    'NetworkVertex',
    'Network',
    'NetworkSettings',
    'TendersQuery',
    'Participates',
    'Awards',
    'HasCPV',
    'Creates',
    'AppliedTo',
    'Comprises',
    'Bidder',
    'Buyer',
    'Actor',
    'Bid',
    'Lot',
    'Tender',
    'CPV',
    'Indicator',
    'Price',
    'Address',
    'Migration',
  ];

  return Promise.map(dbClasses, (className) =>
    config.db.exec(`DROP CLASS ${className} IF EXISTS UNSAFE`));
}

function createDB() {
  return config.migrationManager.up();
}

module.exports = {
  dropDB,
  createDB,
};

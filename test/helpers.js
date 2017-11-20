'use strict';

const Promise = require('bluebird');
const config = require('../config');

function truncateDB() {
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
  ];

  return Promise.map(dbClasses, (className) =>
    config.db.exec(`TRUNCATE CLASS ${className} UNSAFE`));
}

function createDB() {
  return config.migrationManager.up();
}

module.exports = {
  truncateDB,
  createDB,
};

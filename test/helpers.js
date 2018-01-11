'use strict';

const Promise = require('bluebird');
const config = require('../config/default');

async function truncateDB() {
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
    'Bid',
    'Lot',
    'Tender',
    'CPV',
    'Indicator',
    'Price',
    'Address',
    'User',
  ];

  await Promise.map(dbClasses, (className) =>
    config.db.exec(`TRUNCATE CLASS ${className} UNSAFE`));
}

async function createDB() {
  await config.migrationManager.up();
}

module.exports = {
  truncateDB,
  createDB,
};

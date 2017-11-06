'use strict';

const config = require('../config');
const Promise = require('bluebird');

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
    'Migration',
  ];

  return Promise.each(dbClasses, (className) => config.db.exec(`DROP CLASS ${className} IF EXISTS UNSAFE`))
    .then(() => config.migrationManager.up());
}

module.exports = {
  truncateDB,
};

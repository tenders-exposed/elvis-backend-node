'use strict';

const uuidv4 = require('uuid/v4');
const Promise = require('bluebird');
const config = require('../config/default');
const AuthHelper = require('../api/helpers/auth');

async function truncateDB() {
  // Order counts. Delete subclasses first
  const dbClasses = [
    'Contracts',
    'Partners',
    'Incorporates',
    'Includes',
    'ActingAs',
    'PartOf',
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
    'BidHasCPV',
    'Lot',
    'Tender',
    'CPV',
    'Indicator',
    'Price',
    'Address',
    'User',
    'DirectiveCAN',
  ];

  await Promise.map(dbClasses, (className) =>
    config.db.exec(`TRUNCATE CLASS ${className} UNSAFE`));
}

async function createDB() {
  await config.migrationManager.up();
}

async function createUser() {
  const userAttrs = {
    id: uuidv4(),
    active: true,
    email: 'testemail123456@mailinator.com',
    password: await AuthHelper.createPasswordHash('123456789test'),
  };
  await AuthHelper.createTokenPair({ id: userAttrs.id })
    .then((tokens) => Object.assign(userAttrs, {
      accessTokens: [tokens.accessToken],
      refreshTokens: [tokens.refreshToken],
    }));
  return config.db.create('vertex', 'User')
    .set(userAttrs)
    .commit()
    .one();
}

module.exports = {
  truncateDB,
  createDB,
  createUser,
};

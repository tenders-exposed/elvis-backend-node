'use strict';

const Promise = require('bluebird');

exports.name = 'remove xDigiwhistLastModified';

exports.up = (db) => (
  Promise.map(['Bidder', 'Buyer', 'Indicator'], (className) =>
    db.class.get(className)
      .then((Class) => Class.property.drop('xDigiwhistLastModified')))
);

exports.down = (db) => (
  Promise.map(['Bidder', 'Buyer', 'Indicator'], (className) =>
    db.class.get(className)
      .then((Class) =>
        Class.property.create([
          {
            name: 'xDigiwhistLastModified',
            type: 'DateTime',
            mandatory: true,
          }])))
);

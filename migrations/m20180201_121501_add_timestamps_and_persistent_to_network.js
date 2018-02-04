'use strict';

const Promise = require('bluebird');

exports.name = 'add timestamps and persistent to network';

exports.up = (db) => (
  db.class.get('Network')
    .then((Network) =>
      Network.property.create([
        {
          name: 'created',
          type: 'DateTime',
        },
        {
          name: 'updated',
          type: 'DateTime',
        },
      ]))
);

exports.down = (db) => (
  Promise.map(['created', 'updated'], (propName) => {
    db.class.get('Network')
      .then((Network) => Network.property.drop(propName));
  })
);


'use strict';

const Promise = require('bluebird');

exports.name = 'add xCountry and xYear to Bid';

exports.up = (db) => (
  db.class.get('Bid')
    .then((Bid) => {
      Bid.property.create([
        {
          name: 'xYear',
          type: 'Integer',
        },
        {
          name: 'xCountry',
          type: 'String',
          mandatory: true,
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'Bid.xCountry',
        type: 'NOTUNIQUE_HASH_INDEX',
      });
    })
    .then(() => {
      db.index.create({
        name: 'Bid.xYear',
        type: 'NOTUNIQUE_HASH_INDEX',
      });
    })
);

exports.down = (db) => (
  db.class.get('Bid')
    .then((Bid) => Promise.all([
      db.index.drop('Bid.xCountry'),
      db.index.drop('Bid.xYear'),
      Bid.property.drop('xCountry'),
      Bid.property.drop('xYear'),
    ]))
);


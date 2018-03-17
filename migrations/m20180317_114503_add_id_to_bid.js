'use strict';

exports.name = 'add id to bid';

exports.up = (db) => (
  db.class.get('Bid')
    .then((Bid) =>
      Bid.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'Bid.id',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.index.drop('Bid.id')
    .then(() => db.class.get('Bid'))
    .then((Bid) => Bid.property.drop('id'))
);

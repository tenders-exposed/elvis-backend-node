'use strict';

exports.name = 'add id to lot';

exports.up = (db) => (
  db.class.get('Lot')
    .then((Lot) =>
      Lot.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'Lot.id',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.index.drop('Lot.id')
    .then(() => db.class.get('Lot'))
    .then((Lot) => Lot.property.drop('id'))
);

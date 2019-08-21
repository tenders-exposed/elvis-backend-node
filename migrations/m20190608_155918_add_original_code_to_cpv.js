'use strict';

exports.name = 'add original code to CPV';

exports.up = (db) => (
  db.class.get('CPV')
    .then((CPV) =>
      CPV.property.create([
        {
          name: 'xOriginalCode',
          type: 'String',
          mandatory: true,
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'CPV.xOriginalCode',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.class.get('CPV')
    .then((CPV) => CPV.property.drop('xOriginalCode'))
);

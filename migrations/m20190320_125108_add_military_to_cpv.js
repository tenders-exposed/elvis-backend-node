'use strict';

exports.name = 'add military to cpv';

exports.up = (db) => (
  db.class.get('CPV')
    .then((CPV) =>
      CPV.property.create([
        {
          name: 'military',
          type: 'Boolean',
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'CPV.military',
        type: 'NOTUNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.index.drop('CPV.military')
    .then(() => db.class.get('CPV'))
    .then((CPV) => CPV.property.drop('military'))
);


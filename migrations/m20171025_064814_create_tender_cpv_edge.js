'use strict';

exports.name = 'create tender cpv edge';

exports.up = (db) => (
  db.class.create('HasCPV', 'E')
    .then((HasCPV) => {
      HasCPV.property.create([
        {
          name: 'isMain',
          type: 'Boolean',
        },
        {
          name: 'in',
          type: 'Link',
          mandatory: true,
        },
        {
          name: 'out',
          type: 'Link',
          mandatory: true,
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'HasCPV.in.out',
        type: 'UNIQUE_HASH_INDEX',
        class: 'HasCPV',
        properties: ['in', 'out'],
      });
    })
);

exports.down = (db) => (
  db.class.drop('HasCPV')
);

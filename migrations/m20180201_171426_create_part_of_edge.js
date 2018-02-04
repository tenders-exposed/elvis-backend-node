'use strict';

exports.name = 'create part_of edge';

exports.up = (db) => (
  db.class.create('PartOf', 'E')
    .then((PartOf) =>
      PartOf.property.create([
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
      ]))
    .then(() =>
      db.index.create({
        name: 'PartOf.in.out',
        type: 'UNIQUE_HASH_INDEX',
        class: 'PartOf',
        properties: ['in', 'out'],
      }))
);

exports.down = (db) => (
  db.class.drop('PartOf')
);

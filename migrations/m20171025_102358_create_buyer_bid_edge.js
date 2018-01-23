'use strict';

exports.name = 'create buyer bid edge';

exports.up = (db) => (
  db.class.create('Awards', 'E')
    .then((Awards) =>
      Awards.property.create([
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
        name: 'Awards.in.out',
        type: 'UNIQUE_HASH_INDEX',
        class: 'Awards',
        properties: ['in', 'out'],
      }))
);

exports.down = (db) => (
  db.class.drop('Awards')
);

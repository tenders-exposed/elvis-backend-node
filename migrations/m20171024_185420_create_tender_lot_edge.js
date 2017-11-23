'use strict';

exports.name = 'create tender lot edge';

exports.up = (db) => (
  db.class.create('Comprises', 'E')
    .then((Comprises) => {
      Comprises.property.create([
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
        name: 'Comprises.in.out',
        type: 'DICTIONARY_HASH_INDEX',
        class: 'Comprises',
        properties: ['in', 'out'],
      });
    })
);

exports.down = (db) => (
  db.class.drop('Comprises')
);

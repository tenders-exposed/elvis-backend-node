'use strict';

exports.name = 'create bidder bid edge';

exports.up = (db) => (
  db.class.create('Participates', 'E')
    .then((Participates) => {
      Participates.property.create([
        {
          name: 'isLeader',
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
        name: 'Participates.in.out',
        type: 'UNIQUE_HASH_INDEX',
        class: 'Participates',
        properties: ['in', 'out'],
      });
    })
);

exports.down = (db) => (
  db.class.drop('Participates')
);

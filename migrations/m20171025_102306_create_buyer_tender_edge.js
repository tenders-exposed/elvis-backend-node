'use strict';

exports.name = 'create buyer tender edge';

exports.up = (db) => (
  db.class.create('Creates', 'E')
    .then((Creates) =>
      Creates.property.create([
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
      ]))
    .then(() =>
      db.index.create({
        name: 'Creates.in.out',
        type: 'UNIQUE_HASH_INDEX',
        class: 'Creates',
        properties: ['in', 'out'],
      }))
);

exports.down = (db) => (
  db.class.drop('Creates')
);

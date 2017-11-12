'use strict';

exports.name = 'create bid lot edge';

exports.up = (db) => (
  db.class.create('AppliedTo', 'E')
    .then((AppliedTo) => {
      AppliedTo.property.create([
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
        name: 'AppliedTo.in.out',
        type: 'unique',
        class: 'AppliedTo',
        properties: ['in', 'out'],
      });
    })
);

exports.down = (db) => (
  db.class.drop('AppliedTo')
);

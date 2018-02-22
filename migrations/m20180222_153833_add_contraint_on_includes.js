'use strict';

exports.name = 'add contraint on includes';

exports.up = (db) => (
  db.class.get('Includes')
    .then((Includes) =>
      Includes.property.create([
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
        name: 'Includes.in.out',
        type: 'UNIQUE_HASH_INDEX',
        class: 'Includes',
        properties: ['in', 'out'],
      }))
);

exports.down = (db) => (
  Promise.map(['in', 'out'], (propName) => {
    db.class.get('Includes')
      .then((Includes) => Includes.property.drop(propName));
  }).then(() => db.index.drop('Includes.in.out'))
);


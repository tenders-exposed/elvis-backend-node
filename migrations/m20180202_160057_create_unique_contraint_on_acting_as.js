'use strict';

const Promise = require('bluebird');

exports.name = 'create unique contraint on acting as';

exports.up = (db) => (
  db.class.get('ActingAs')
    .then((ActingAs) =>
      ActingAs.property.create([
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
        name: 'ActingAs.in.out',
        type: 'UNIQUE_HASH_INDEX',
        class: 'ActingAs',
        properties: ['in', 'out'],
      }))
);

exports.down = (db) => (
  Promise.map(['in', 'out'], (propName) => {
    db.class.get('ActingAs')
      .then((ActingAs) => ActingAs.property.drop(propName));
  }).then(() => db.index.drop('ActingAs.in.out'))
);


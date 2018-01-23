'use strict';

exports.name = 'create country class';

exports.up = (db) => (
  db.class.create('Country')
    .then((Country) =>
      Country.property.create([
        {
          name: 'code',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'name',
          type: 'String',
          mandatory: true,
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'Country.code',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => db.class.drop('Country');

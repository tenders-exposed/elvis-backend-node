'use strict';

exports.name = 'create directivecan class';


exports.up = (db) => (
  db.class.create('DirectiveCAN')
    .then((DirectiveCAN) =>
      DirectiveCAN.property.create([
        {
          name: 'sourceUrl',
          type: 'String',
          mandatory: true,
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'DirectiveCAN.sourceUrl',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => db.class.drop('DirectiveCAN');

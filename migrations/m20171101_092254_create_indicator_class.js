'use strict';

exports.name = 'create indicator class';

exports.up = (db) => (
  db.class.create('Indicator')
    .then((Indicator) =>
      Indicator.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'xDigiwhistLastModified',
          type: 'DateTime',
        },
        {
          name: 'type',
          type: 'String',
        },
        {
          name: 'value',
          type: 'double',
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'Indicator.id',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.class.drop('Indicator')
);

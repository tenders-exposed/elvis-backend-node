'use strict';

exports.name = 'create cpv vertex';

exports.up = (db) => (
  db.class.create('CPV', 'V')
    .then((CPV) => {
      CPV.property.create([
        {
          name: 'code',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'xName',
          type: 'String',
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'CPV.code',
        type: 'UNIQUE_HASH_INDEX',
      });
    })
);

exports.down = (db) => (
  db.class.drop('CPV')
);

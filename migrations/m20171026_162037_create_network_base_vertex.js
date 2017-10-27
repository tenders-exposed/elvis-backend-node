'use strict';

exports.name = 'create network base vertex';

exports.up = (db) => (
  db.class.create('NetworkVertex', 'V')
    .then((NetworkVertex) => {
      NetworkVertex.property.create([
        {
          name: 'visible',
          type: 'Boolean',
          mandatory: true,
          default: true,
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('NetworkVertex')
);

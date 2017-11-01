'use strict';

exports.name = 'create network base vertex';

exports.up = (db) => (
  db.class.create('NetworkVertex', 'V')
    .then((NetworkVertex) => {
      NetworkVertex.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'visible',
          type: 'Boolean',
          mandatory: true,
          default: true,
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'NetworkVertex.id',
        type: 'unique',
      });
    })
);

exports.down = (db) => (
  db.class.drop('NetworkVertex')
);

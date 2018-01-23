'use strict';

exports.name = 'create network base edge';

exports.up = (db) => (
  db.class.create('NetworkEdge', 'E')
    .then((NetworkEdge) =>
      NetworkEdge.property.create([
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
      ]))
    .then(() =>
      db.index.create({
        name: 'NetworkEdge.id',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.class.drop('NetworkEdge')
);

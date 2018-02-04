'use strict';

exports.name = 'drop id from node';

exports.up = (db) => (
  db.index.drop('NetworkEdge.id')
    .then(() => db.class.get('NetworkEdge'))
    .then((NetworkEdge) => NetworkEdge.property.drop('id'))
);

exports.down = (db) => (
  db.class.get('NetworkEdge')
    .then((NetworkEdge) =>
      NetworkEdge.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        }]))
    .then(() =>
      db.index.create({
        name: 'NetworkEdge.id',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

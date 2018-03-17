'use strict';

exports.name = 'add unique index for network edge';

exports.up = (db) => (
  db.index.create({
    name: 'NetworkEdge.uuid',
    type: 'UNIQUE_HASH_INDEX',
  })
);

exports.down = (db) => db.index.drop('NetworkEdge.uuid');

'use strict';

exports.name = 'update index on cpv code';

exports.up = (db) => db.index.drop('CPV.code')
  .then(() => db.index.create({
    name: 'CPV.code',
    type: 'NOTUNIQUE_HASH_INDEX',
  }));

exports.down = (db) => db.index.drop('CPV.code')
  .then(() => db.index.create({
    name: 'CPV.code',
    type: 'UNIQUE_HASH_INDEX',
  }));

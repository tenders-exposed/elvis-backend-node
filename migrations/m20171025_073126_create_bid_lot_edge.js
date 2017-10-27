'use strict';

exports.name = 'create bid lot edge';

exports.up = (db) => (
  db.class.create('AppliedTo', 'E')
);

exports.down = (db) => (
  db.class.drop('AppliedTo')
);

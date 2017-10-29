'use strict';

exports.name = 'create buyer tender edge';

exports.up = (db) => (
  db.class.create('Creates', 'E')
);

exports.down = (db) => (
  db.class.drop('Creates')
);

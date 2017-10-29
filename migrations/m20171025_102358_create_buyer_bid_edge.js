'use strict';

exports.name = 'create buyer bid edge';

exports.up = (db) => (
  db.class.create('Awards', 'E')
);

exports.down = (db) => (
  db.class.drop('Awards')
);

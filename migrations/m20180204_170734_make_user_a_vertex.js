'use strict';

exports.name = 'make user a vertex';

exports.up = (db) => (
  db.class.update({
    name: 'User',
    superClass: 'V',
  })
);

exports.down = (db) => (
  db.class.update({
    name: 'User',
    superClass: '-V',
  })
);


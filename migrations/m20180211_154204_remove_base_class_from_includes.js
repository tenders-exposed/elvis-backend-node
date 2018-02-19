'use strict';

exports.name = 'remove base class from includes';

exports.up = (db) => (
  db.class.update({
    name: 'Includes',
    superClass: 'E',
  })
);

exports.down = (db) => (
  db.class.update({
    name: 'Includes',
    superClass: 'NetworkEdge',
  })
);

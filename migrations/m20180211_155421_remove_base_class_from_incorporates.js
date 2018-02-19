'use strict';

exports.name = 'remove base class from incorporates';


exports.up = (db) => (
  db.class.update({
    name: 'Incorporates',
    superClass: 'E',
  })
);

exports.down = (db) => (
  db.class.update({
    name: 'Incorporates',
    superClass: 'NetworkEdge',
  })
);

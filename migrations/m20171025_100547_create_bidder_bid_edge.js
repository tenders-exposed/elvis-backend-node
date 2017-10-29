'use strict';

exports.name = 'create bidder bid edge';

exports.up = (db) => (
  db.class.create('Participates', 'E')
);

exports.down = (db) => (
  db.class.drop('Participates')
);

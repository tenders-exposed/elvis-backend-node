'use strict';

exports.name = 'create bidder vertex';

exports.up = (db) => (
  db.class.create('Bidder', 'Actor')
);

exports.down = (db) => (
  db.class.drop('Bidder')
);

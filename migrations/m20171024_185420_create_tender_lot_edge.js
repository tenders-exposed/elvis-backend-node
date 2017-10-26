"use strict";
exports.name = "create tender lot edge";

exports.up = (db) => (
  db.class.create('Comprises', 'E')
);

exports.down = (db) => (
  db.class.drop('Comprises')
);

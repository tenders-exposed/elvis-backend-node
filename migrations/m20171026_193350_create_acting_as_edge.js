"use strict";
exports.name = "create acting_as edge";

exports.up = (db) => (
  db.class.create('ActingAs', 'E')
);

exports.down = (db) => (
  db.class.drop('ActingAs')
);

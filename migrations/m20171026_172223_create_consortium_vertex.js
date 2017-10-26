"use strict";
exports.name = "create consortium vertex";

exports.up = (db) => (
  db.class.create('ActorConsortium', 'NetworkActor')
);

exports.down = (db) => (
  db.class.drop('ActorConsortium')
);

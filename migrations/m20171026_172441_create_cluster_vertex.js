'use strict';

exports.name = 'create cluster vertex';

exports.up = (db) => (
  db.class.create('ActorCluster', 'NetworkActor')
);

exports.down = (db) => (
  db.class.drop('ActorCluster')
);

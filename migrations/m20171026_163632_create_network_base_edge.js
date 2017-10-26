"use strict";
exports.name = "create network base edge";

exports.up = (db) => (
  db.class.create('NetworkEdge', 'E')
  .then((NetworkEdge) => {
    NetworkEdge.property.create([
      {
        name: 'visible',
        type: 'Boolean',
        mandatory: true,
        default: true,
      },
   ]);
  })
);

exports.down = (db) => (
  db.class.drop('NetworkEdge')
);

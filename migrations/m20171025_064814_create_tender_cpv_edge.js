"use strict";
exports.name = "create tender cpv edge";

exports.up = (db) => (
  db.class.create('HasCPV', 'E')
  .then((HasCPV) => {
    HasCPV.property.create([
      {
        name: 'isMain',
        type: 'Boolean',
      },
    ]);
  })
);

exports.down = (db) => (
  db.class.drop('HasCPV')
);

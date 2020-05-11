"use strict";
exports.name = "add country to NetworkActor";

exports.up = function (db) {
  db.class.get('NetworkActor')
    .then((NetworkActor) =>
      NetworkActor.property.create([
        {
          name: 'countries',
          type: 'EmbeddedSet',
        },
      ]))
};

exports.down = (db) => (
  db.class.get('NetworkActor')
    .then((NetworkActor) => NetworkActor.property.drop('countries'))
);


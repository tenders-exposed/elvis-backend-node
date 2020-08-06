"use strict";
exports.name = "remove_flags_from_networkActor";

exports.up = function (db) {
  db.class.get('NetworkActor')
    .then((NetworkActor) => NetworkActor.property.drop('flags'))
};

exports.down = function (db) {
  db.class.get('NetworkActor')
  .then((NetworkActor) =>
    NetworkActor.property.create([
      {
        name: 'flags',
        type: 'EmbeddedList',
      },
    ]))
};


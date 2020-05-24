"use strict";
exports.name = "add_updateNeeded_to_network";


exports.up = (db) => (
  db.class.get('Network')
    .then((Network) =>
      Network.property.create([
        {
          name: 'xUpdateNeeded',
          type: 'Boolean',
          default: false,
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Network')
    .then((Network) => Network.property.drop('xUpdateNeeded'))
);

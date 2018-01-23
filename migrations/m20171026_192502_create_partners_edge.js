'use strict';

exports.name = 'create partners edge';

exports.up = (db) => (
  db.class.create('Partners', 'NetworkEdge')
    .then((Partners) =>
      Partners.property.create([
        {
          name: 'value',
          type: 'Double',
          mandatory: true,
        },
      ]))
);

exports.down = (db) => (
  db.class.drop('Partners')
);

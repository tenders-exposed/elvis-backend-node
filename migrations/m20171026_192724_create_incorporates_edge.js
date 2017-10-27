'use strict';

exports.name = 'create incorporates edge';

exports.up = (db) => (
  db.class.create('Incorporates', 'NetworkEdge')
    .then((Incorporates) => {
      Incorporates.property.create([
        {
          name: 'percent',
          type: 'Double',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Incorporates')
);

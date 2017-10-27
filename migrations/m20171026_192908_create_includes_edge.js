'use strict';

exports.name = 'create includes edge';

exports.up = (db) => (
  db.class.create('Includes', 'NetworkEdge')
    .then((Includes) => {
      Includes.property.create([
        {
          name: 'percent',
          type: 'Double',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Includes')
);

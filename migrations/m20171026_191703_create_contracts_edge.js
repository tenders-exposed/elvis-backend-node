'use strict';

exports.name = 'create contracts edge';

exports.up = (db) => (
  db.class.create('Contracts', 'NetworkEdge')
    .then((Contracts) => {
      Contracts.property.create([
        {
          name: 'value',
          type: 'Double',
          mandatory: true,
        },
        {
          name: 'flags',
          type: 'EmbeddedList',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Contracts')
);

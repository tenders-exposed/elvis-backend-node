'use strict';

exports.name = 'create bidder bid edge';

exports.up = (db) => (
  db.class.create('Participates', 'E')
    .then((Participates) => {
      Participates.property.create([
        {
          name: 'isLeader',
          type: 'Boolean',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Participates')
);

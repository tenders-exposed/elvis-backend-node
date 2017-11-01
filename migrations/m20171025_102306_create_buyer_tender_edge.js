'use strict';

exports.name = 'create buyer tender edge';

exports.up = (db) => (
  db.class.create('Creates', 'E')
    .then((Creates) => {
      Creates.property.create([
        {
          name: 'isLeader',
          type: 'Boolean',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Creates')
);

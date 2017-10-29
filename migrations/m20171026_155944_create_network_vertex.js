'use strict';

exports.name = 'create network vertex';

exports.up = (db) => (
  db.class.create('Network', 'V')
    .then((Network) => {
      Network.property.create([
        {
          name: 'query',
          type: 'Embedded',
          linkedClass: 'TendersQuery',
        },
        {
          name: 'settings',
          type: 'Embedded',
          linkedClass: 'NetworkSettings',
        },
        {
          name: 'name',
          type: 'String',
        },
        {
          name: 'description',
          type: 'String',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Network')
);

'use strict';

exports.name = 'create actor vertex';

exports.up = (db) => (
  db.class.create('Actor', 'V')
    .then((Actor) => {
      Actor.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'name',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'address',
          type: 'Embedded',
          linkedClass: 'Address',
        },
        {
          name: 'xDigiwhistLastModified',
          type: 'DateTime',
          mandatory: true,
        },
        {
          name: 'isPublic',
          type: 'Boolean',
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'Actor.id',
        type: 'unique',
      });
    })
);

exports.down = (db) => (
  db.class.drop('Actor')
);

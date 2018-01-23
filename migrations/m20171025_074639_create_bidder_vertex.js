'use strict';

exports.name = 'create bidder vertex';

exports.up = (db) => (
  db.class.create('Bidder', 'V')
    .then((Bidder) =>
      Bidder.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'name',
          type: 'String',
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
      ]))
    .then(() =>
      db.index.create({
        name: 'Bidder.id',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.class.drop('Bidder')
);

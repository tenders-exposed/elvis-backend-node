'use strict';

exports.name = 'create buyer vertex';

exports.up = (db) => (
  db.class.create('Buyer', 'V')
    .then((Buyer) => {
      Buyer.property.create([
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
        {
          name: 'buyerType',
          type: 'String',
        },
        {
          name: 'isSubsidized',
          type: 'Boolean',
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'Buyer.id',
        type: 'UNIQUE_HASH_INDEX',
      });
    })
);

exports.down = (db) => (
  db.class.drop('Buyer')
);

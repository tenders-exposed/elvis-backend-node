'use strict';

exports.name = 'create buyer vertex';

exports.up = (db) => (
  db.class.create('Buyer', 'Actor')
    .then((Buyer) => {
      Buyer.property.create([
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
);

exports.down = (db) => (
  db.class.drop('Buyer')
);

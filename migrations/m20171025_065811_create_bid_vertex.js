'use strict';

exports.name = 'create bid vertex';

exports.up = (db) => (
  db.class.create('Bid', 'V')
    .then((Bid) => {
      Bid.property.create([
        {
          name: 'isWinning',
          type: 'Boolean',
          mandatory: true,
        },
        {
          name: 'isSubcontracted',
          type: 'Boolean',
        },
        {
          name: 'isAwardedToGroupOfSuppliers',
          type: 'Boolean',
        },
        {
          name: 'price',
          type: 'Embedded',
          linkedClass: 'Price',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Bid')
);

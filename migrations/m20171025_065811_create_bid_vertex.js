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
          name: 'isConsortium',
          type: 'Boolean',
        },
        {
          name: 'isDisqualified',
          type: 'Boolean',
        },
        {
          name: 'price',
          type: 'Embedded',
          linkedClass: 'Price',
        },
        {
          name: 'robustPrice',
          type: 'Embedded',
          linkedClass: 'Price',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Bid')
);

'use strict';

exports.name = 'create price class';

exports.up = (db) => (
  db.class.create('Price')
    .then((Price) => {
      Price.property.create([
        {
          name: 'amountWithVat',
          type: 'Double',
        },
        {
          name: 'currency',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'currencyNational',
          type: 'String',
        },
        {
          name: 'netAmount',
          type: 'Double',
          mandatory: true,
        },
        {
          name: 'netAmountEur',
          type: 'Double',
          mandatory: true,
        },
        {
          name: 'netAmountNational',
          type: 'Double',
          mandatory: true,
        },
        {
          name: 'publicationDate',
          type: 'Date',
        },
        {
          name: 'vat',
          type: 'Double',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Price')
);

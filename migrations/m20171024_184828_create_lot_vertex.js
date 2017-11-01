'use strict';

exports.name = 'create lot vertex';

exports.up = (db) => (
  db.class.create('Lot', 'V')
    .then((Lot) => {
      Lot.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'title',
          type: 'String',
        },
        {
          name: 'description',
          type: 'String',
        },
        {
          name: 'contractNumber',
          type: 'String',
        },
        {
          name: 'lotNumber',
          type: 'Double',
        },
        {
          name: 'bidsCount',
          type: 'Integer',
          mandatory: true,
        },
        {
          name: 'validBidsCount',
          type: 'Integer',
        },
        {
          name: 'awardDecisionDate',
          type: 'Date',
          mandatory: true,
        },
        {
          name: 'awardCriteria',
          type: 'EmbeddedList',
        },
        {
          name: 'addressOfImplementation',
          type: 'Embedded',
          linkedClass: 'Address',
        },
        {
          name: 'status',
          type: 'String',
        },
        {
          name: 'estimatedPrice',
          type: 'Embedded',
          linkedClass: 'Price',
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'Lot.id',
        type: 'unique',
      });
    })
);

exports.down = (db) => (
  db.class.drop('Lot')
);

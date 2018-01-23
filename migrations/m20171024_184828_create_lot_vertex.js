'use strict';

exports.name = 'create lot vertex';

exports.up = (db) => (
  db.class.create('Lot', 'V')
    .then((Lot) =>
      Lot.property.create([
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
      ]))
);

exports.down = (db) => (
  db.class.drop('Lot')
);

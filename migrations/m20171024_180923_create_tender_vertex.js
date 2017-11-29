'use strict';

exports.name = 'create tender vertex';

exports.up = (db) => (
  db.class.create('Tender', 'V')
    .then((Tender) => {
      Tender.property.create([
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
          name: 'country',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'isFrameworkAgreement',
          type: 'Boolean',
        },
        {
          name: 'isCoveredByGpa',
          type: 'Boolean',
        },
        {
          name: 'nationalProcedureType',
          type: 'String',
        },
        {
          name: 'finalPrice',
          type: 'Embedded',
          linkedClass: 'Price',
        },
        {
          name: 'xIsEuFunded',
          type: 'Boolean',
        },
        {
          name: 'isWholeTenderCancelled',
          type: 'Boolean',
        },
        {
          name: 'xDigiwhistLastModified',
          type: 'DateTime',
          mandatory: true,
        },
      ]);
    })
    .then(() => {
      db.index.create({
        name: 'Tender.id',
        type: 'UNIQUE_HASH_INDEX',
      });
    })
);

exports.down = (db) => (
  db.class.drop('Tender')
);

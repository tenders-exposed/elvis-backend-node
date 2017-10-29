'use strict';

exports.name = 'create tender vertex';

exports.up = (db) => (
  db.class.create('Tender', 'V')
    .then((Tender) => {
      Tender.property.create([
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
          name: 'xDigiwhistPersistentID',
          type: 'String',
          unique: true,
          mandatory: true,
        },
        {
          name: 'xDigiwhistLastModified',
          type: 'DateTime',
          mandatory: true,
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.drop('Tender')
);

'use strict';

exports.name = 'replace national procedure type with procedure type';

exports.up = (db) => (
  db.class.get('Tender')
    .then((Tender) => Tender.property.drop('nationalProcedureType'))
    .then((Tender) => Tender.property.create({
      name: 'procedureType',
      type: 'String',
    }))
);

exports.down = (db) => (
  db.class.get('Tender')
    .then((Tender) => Tender.property.drop('procedureType'))
    .then((Tender) =>
      Tender.property.create([
        {
          name: 'nationalProcedureType',
          type: 'String',
        }]))
);

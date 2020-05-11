"use strict";
exports.name = "remove xTEDCNID from tender";


exports.up = (db) => (
  db.class.get('Tender')
  .then((Tender) => Tender.property.drop('xTEDCNID'))
);

exports.down = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.create([
        {
          name: 'xTEDCNID',
          type: 'String',
        },
      ]))
);

"use strict";
exports.name = "add_year_approximated_to_tender";

exports.up = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.create([
        {
          name: 'xYearApproximated',
          type: 'Boolean',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Tender')
    .then((Tender) => Tender.property.drop('xYearApproximated'))
);

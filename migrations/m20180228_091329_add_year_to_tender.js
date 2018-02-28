'use strict';

exports.name = 'add year to tender';

exports.up = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.create([
        {
          name: 'year',
          type: 'Integer',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Tender')
    .then((Tender) => Tender.property.drop('year'))
);

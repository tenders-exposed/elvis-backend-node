'use strict';

exports.name = 'add xIsDirective to tender';

exports.up = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.create([
        {
          name: 'xIsDirective',
          type: 'Boolean',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Tender')
    .then((Tender) => Tender.property.drop('xIsDirective'))
);

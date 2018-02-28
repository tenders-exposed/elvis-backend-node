'use strict';

exports.name = 'add selection menthod to lot';

exports.up = (db) => (
  db.class.get('Lot')
    .then((Lot) =>
      Lot.property.create([
        {
          name: 'selectionMethod',
          type: 'String',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Lot')
    .then((Lot) => Lot.property.drop('selectionMethod'))
);

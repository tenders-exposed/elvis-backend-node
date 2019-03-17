'use strict';

exports.name = 'remove mandatory constraint on lot bidsCount';

exports.up = (db) => (
  db.class.get('Lot')
    .then((Lot) =>
      Lot.property.update({
        name: 'bidsCount',
        mandatory: false,
      })));

exports.down = (db) => (
  db.class.get('Lot')
    .then((Lot) =>
      Lot.property.update({
        name: 'bidsCount',
        type: 'Integer',
        mandatory: true,
      })));

'use strict';

exports.name = 'add xNumberDigits to cpv';

exports.up = (db) => (
  db.class.get('CPV')
    .then((CPV) => {
      CPV.property.create([
        {
          name: 'xNumberDigits',
          type: 'Integer',
        },
      ]);
    })
);

exports.down = (db) => (
  db.class.get('CPV')
    .then((CPV) => CPV.property.drop('xNumberDigits'))
);

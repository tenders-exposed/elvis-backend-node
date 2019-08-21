'use strict';

exports.name = 'remove mandatory on cpv code';

exports.up = (db) => (
  db.class.get('CPV')
    .then((CPV) =>
      CPV.property.update({
        name: 'code',
        mandatory: false,
      })));

exports.down = (db) => (
  db.class.get('CPV')
    .then((CPV) =>
      CPV.property.update({
        name: 'code',
        type: 'String',
        mandatory: true,
      })));

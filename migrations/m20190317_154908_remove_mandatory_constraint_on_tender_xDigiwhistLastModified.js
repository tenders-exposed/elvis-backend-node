'use strict';

exports.name = 'remove mandatory constraint on tender xDigiwhistLastModified';

exports.up = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.update({
        name: 'xDigiwhistLastModified',
        mandatory: false,
      })));

exports.down = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.update({
        name: 'xDigiwhistLastModified',
        type: 'DateTime',
        mandatory: true,
      })));

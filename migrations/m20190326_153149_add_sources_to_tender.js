'use strict';

exports.name = 'add sources to tender';

exports.up = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.create([
        {
          name: 'sources',
          type: 'EmbeddedSet',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Tender')
    .then((Tender) => Tender.property.drop('sources'))
);


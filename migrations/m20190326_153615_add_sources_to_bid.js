'use strict';

exports.name = 'add sources to bid';

exports.up = (db) => (
  db.class.get('Bid')
    .then((Bid) =>
      Bid.property.create([
        {
          name: 'sources',
          type: 'EmbeddedSet',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Bid')
    .then((Bid) => Bid.property.drop('sources'))
);


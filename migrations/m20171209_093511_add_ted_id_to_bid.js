'use strict';

exports.name = 'add TED Contract Award Notice ID to bid';

exports.up = (db) => (
  db.class.get('Bid')
    .then((Bid) =>
      Bid.property.create([
        {
          name: 'xTEDCANID',
          type: 'String',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Bid')
    .then((Bid) => Bid.property.drop('xTEDCANID'))
);

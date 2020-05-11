"use strict";
exports.name = "remove xTEDCANID from Bid";

exports.up = (db) => (
  db.class.get('Bid')
  .then((Bid) => Bid.property.drop('xTEDCANID'))
);

exports.down = (db) => (
  db.class.get('Bid')
    .then((Bid) =>
      Bid.property.create([
        {
          name: 'xTEDCANID',
          type: 'String',
        },
      ]))
);

"use strict";
exports.name = "add_year_approximated_to_bid";

exports.up = (db) => (
  db.class.get('Bid')
    .then((Bid) =>
      Bid.property.create([
        {
          name: 'xYearApproximated',
          type: 'Boolean',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Bid')
    .then((Bid) => Bid.property.drop('xYearApproximated'))
);

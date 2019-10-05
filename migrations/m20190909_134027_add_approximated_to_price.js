"use strict";
exports.name = "add_approximated_to_price";

exports.up = (db) => (
  db.class.get('Price')
    .then((Price) =>
      Price.property.create([
        {
          name: 'xAmountApproximated',
          type: 'Boolean',
        },
      ]))
);

exports.down = (db) => (
  db.class.get('Price')
    .then((Price) => Price.property.drop('xAmountApproximated'))
);

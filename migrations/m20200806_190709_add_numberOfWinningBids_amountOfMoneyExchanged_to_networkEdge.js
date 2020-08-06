"use strict";
exports.name = "add_numberOfWinningBids_amountOfMoneyExchanged_to_networkEdge";

const Promise = require('bluebird');

exports.up = (db) => (
  db.class.get('NetworkEdge')
    .then((NetworkEdge) =>
      NetworkEdge.property.create([
        {
          name: 'numberOfWinningBids',
          type: 'Integer',
        },
        {
          name: 'amountOfMoneyExchanged',
          type: 'Integer',
        },
      ]))
);

exports.down = (db) => (
  Promise.map(['numberOfWinningBids', 'amountOfMoneyExchanged'], (propName) => {
    db.class.get('NetworkEdge')
      .then((NetworkEdge) => NetworkEdge.property.drop(propName));
  })
);

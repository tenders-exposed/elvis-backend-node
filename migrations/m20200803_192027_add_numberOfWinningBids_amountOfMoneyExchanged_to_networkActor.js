'use strict';
exports.name = 'add_numberOfWinningBids_amountOfMoneyExchanged_to_networkActor';

const Promise = require('bluebird');

exports.up = (db) => (
  db.class.get('NetworkActor')
    .then((NetworkActor) =>
      NetworkActor.property.create([
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
    db.class.get('NetworkActor')
      .then((NetworkActor) => NetworkActor.property.drop(propName));
  })
);


"use strict";

const Promise = require('bluebird');

exports.name = "remove_contraints_on_price";

exports.up = (db) => (
  Promise.map(['currency', 'netAmount'], (propName) => {
    return db.class.get('Price')
    .then((Price) =>
      Price.property.update({
        name: propName,
        mandatory: false,
      }));
  }))

exports.down = (db) => (
  Promise.map(['currency', 'netAmount'], (propName) => {
    return db.class.get('Price')
    .then((Price) =>
      Price.property.update({
        name: propName,
        mandatory: true,
        type: (propName === 'netAmount') ? 'Double' : 'String',
      }));
  }))
'use strict';

const Promise = require('bluebird');

exports.name = 'add indicators to tender bid lot actor';

exports.up = (db) => (
  Promise.map(['Tender', 'Actor'], (className) => {
    db.class.get(className)
      .then((Class) => {
        Class.property.create([
          {
            name: 'indicators',
            type: 'EmbeddedSet',
            linkedClass: 'Indicator',
          },
        ]);
      });
  })
);

exports.down = (db) => (
  Promise.map(['Tender', 'Actor'], (className) => {
    db.class.get(className)
      .then((Class) => Class.property.drop('indicators'));
  })
);

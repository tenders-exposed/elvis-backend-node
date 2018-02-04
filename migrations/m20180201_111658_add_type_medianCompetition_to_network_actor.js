'use strict';

const Promise = require('bluebird');

exports.name = 'add type and medianCompetition to network actor';

exports.up = (db) => (
  db.class.get('NetworkActor')
    .then((NetworkActor) =>
      NetworkActor.property.create([
        {
          name: 'type',
          type: 'String',
        },
        {
          name: 'medianCompetition',
          type: 'Double',
        },
        {
          name: 'country',
          type: 'String',
        },
      ]))
);

exports.down = (db) => (
  Promise.map(['type', 'medianCompetition', 'country'], (propName) => {
    db.class.get('NetworkActor')
      .then((NetworkActor) => NetworkActor.property.drop(propName));
  })
);


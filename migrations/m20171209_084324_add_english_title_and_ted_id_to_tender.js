'use strict';

const Promise = require('bluebird');

exports.name = 'add english title and TED Contract Notice ID to tender';

exports.up = (db) => (
  db.class.get('Tender')
    .then((Tender) =>
      Tender.property.create([
        {
          name: 'titleEnglish',
          type: 'String',
        },
        {
          name: 'xTEDCNID',
          type: 'String',
        },
      ]))
);

exports.down = (db) => (
  Promise.map(['xTEDCNID', 'titleEnglish'], (propName) => {
    db.class.get('Tender')
      .then((Tender) => Tender.property.drop(propName));
  })
);

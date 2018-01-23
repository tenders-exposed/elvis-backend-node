'use strict';

exports.name = 'create address class';

exports.up = (db) => (
  db.class.create('Address')
    .then((Address) =>
      Address.property.create([
        {
          name: 'country',
          type: 'String',
        },
        {
          name: 'city',
          type: 'String',
        },
        {
          name: 'postcode',
          type: 'String',
        },
        {
          name: 'street',
          type: 'String',
        },
        {
          name: 'rawAddress',
          type: 'String',
        },
        {
          name: 'nuts',
          type: 'EmbeddedList',
        },
      ]))
);

exports.down = (db) => (
  db.class.drop('Address')
);

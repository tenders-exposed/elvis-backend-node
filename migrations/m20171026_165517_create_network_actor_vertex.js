'use strict';

exports.name = 'create network actor';

exports.up = (db) => (
  db.class.create('NetworkActor', 'NetworkVertex')
    .then((NetworkActor) =>
      NetworkActor.property.create([
        {
          name: 'label',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'value',
          type: 'Double',
          mandatory: true,
        },
        {
          name: 'flags',
          type: 'EmbeddedList',
        },
      ]))
);

exports.down = (db) => (
  db.class.drop('NetworkActor')
);

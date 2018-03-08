'use strict';

exports.name = 'add id to network edge';

exports.up = (db) => (
  db.class.get('NetworkEdge')
    .then((NetworkEdge) =>
      NetworkEdge.property.create([
        {
          name: 'uuid',
          type: 'String',
          mandatory: true,
        },
      ]))
);

exports.down = (db) => (
  db.class.get('NetworkEdge')
    .then((NetworkEdge) => NetworkEdge.property.drop('uuid'))
);

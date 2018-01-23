'use strict';

exports.name = 'create network settings class';

exports.up = (db) => (
  db.class.create('NetworkSettings')
    .then((NetworkSettings) =>
      NetworkSettings.property.create([
        {
          name: 'nodeSize',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'edgeSize',
          type: 'String',
          mandatory: true,
        },
      ]))
);

exports.down = (db) => (
  db.class.drop('NetworkSettings')
);

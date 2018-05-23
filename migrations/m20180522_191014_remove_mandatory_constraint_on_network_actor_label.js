'use strict';

exports.name = 'remove mandatory constraint on network actor label';

exports.up = (db) => (
  db.class.get('NetworkActor')
    .then((NetworkActor) =>
      NetworkActor.property.update({
        name: 'label',
        mandatory: false,
      })));

exports.down = (db) => (
  db.class.get('NetworkActor')
    .then((NetworkActor) =>
      NetworkActor.property.update({
        name: 'label',
        type: 'String',
        mandatory: true,
      })));

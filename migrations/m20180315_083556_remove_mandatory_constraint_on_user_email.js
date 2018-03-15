'use strict';

exports.name = 'remove mandatory constraint on user email';

exports.up = (db) => (
  db.class.get('User')
    .then((User) =>
      User.property.update({
        name: 'email',
        mandatory: false,
      })));

exports.down = (db) => (
  db.class.get('User')
    .then((User) =>
      User.property.update({
        name: 'email',
        type: 'String',
        mandatory: true,
      })));


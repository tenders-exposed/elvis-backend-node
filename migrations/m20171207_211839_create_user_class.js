'use strict';

exports.name = 'users';

exports.up = (db) => (
  db.class.create('User')
    .then((User) =>
      User.property.create([
        {
          name: 'id',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'email',
          type: 'String',
          mandatory: true,
        },
        {
          name: 'password',
          type: 'String',
        },
        {
          name: 'twitterId',
          type: 'String',
        },
        {
          name: 'githubId',
          type: 'String',
        },
        {
          name: 'active',
          type: 'Boolean',
          mandatory: true,
          default: false,
        },
        {
          name: 'accessTokens',
          type: 'EmbeddedSet',
        },
        {
          name: 'refreshTokens',
          type: 'EmbeddedSet',
        },
      ]))
    .then(() =>
      db.index.create({
        name: 'User.id',
        type: 'UNIQUE_HASH_INDEX',
      }))
);

exports.down = (db) => (
  db.class.drop('User')
);

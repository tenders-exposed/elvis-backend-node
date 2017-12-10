'use strict';

exports.name = 'users';

exports.up = (db) => {
  db.class.create('Users')
    .then((Users) => {
      Users.property.create([
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
          name: 'regProvider',
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
      ]);
    });
};

exports.down = (db) => {
  db.class.drop('Users');
};

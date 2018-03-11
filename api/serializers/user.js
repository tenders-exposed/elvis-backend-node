'use strict';

const _ = require('lodash');

function formatUser(user) {
  return _.pick(user, ['id', 'email', 'twitterId', 'githubId', 'active']);
}

module.exports = {
  formatUser,
};

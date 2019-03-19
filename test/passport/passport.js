'use strict';

const test = require('ava');
const passport = require('../../passport/index');
const helpers = require('../helpers');

test.before('Create DB', () => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

test.cb('passport:github', (t) => {
  t.plan(5);
  const githubUserAttrs = {
    id: '123456',
    emails: [{ value: 'testemail123456@mailinator.com', primary: true }],
  };
  passport.githubStrategyCallback(null, null, githubUserAttrs, (err, user) => {
    t.is(err, null);
    t.truthy(user);
    t.is(user.githubId, '123456');
    t.is(user.email, 'testemail123456@mailinator.com');
    t.pass();
    t.end();
  });
});

test.cb('passport:twitter', (t) => {
  t.plan(5);
  const twitterUserAttrs = {
    id: '123456',
    emails: [{ value: 'testemail123456@mailinator.com', primary: true }],
  };
  passport.twitterStrategyCallback(null, null, twitterUserAttrs, (err, user) => {
    t.is(err, null);
    t.truthy(user);
    t.is(user.twitterId, '123456');
    t.is(user.email, 'testemail123456@mailinator.com');
    t.pass();
    t.end();
  });
});

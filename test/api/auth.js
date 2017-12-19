'use strict';

const app = require('../../server');
const request = require('supertest');
const test = require('ava').test;
const helpers = require('../helpers');
const passport = require('../../passport');

const SUCCESS = 200;
const BAD_REQUEST = 400;
const REGISTER_ROUTE = '/auth/register';
const LOGIN_ROUTE = '/auth/login';
const REFRESH_TOKEN_ROUTE = '/auth/token/refresh';

test.before('Create DB', () => helpers.createDB());
test.beforeEach(async (t) => {
  t.plan(5);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ email: 'testemail123456@mailinator.com', password: '123456789test' });

  t.is(res.status, SUCCESS);
  t.truthy(res.body.data);
  t.is(res.body.data.email, 'testemail123456@mailinator.com');
  t.is(res.body.data.regProvider, 'local');
  t.truthy(res.body.data.userId);
});
test.afterEach.always(() => {
  return helpers.truncateDB();
});

test('register: Validation error, email pattern', async (t) => {
  t.plan(2);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ email: 'testemail123456', password: '123456789test' });

  t.is(res.status, BAD_REQUEST);
  t.regex(res.body.message, /^Validation error/);
});

test('register: Swagger SCHEMA_VALIDATION_FAILED, email required', async (t) => {
  t.plan(6);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ password: '123456789test' });

  t.is(res.status, BAD_REQUEST);
  t.is(res.body.code, 'SCHEMA_VALIDATION_FAILED');
  t.truthy(res.body.results);
  t.truthy(res.body.results.errors);
  t.truthy(res.body.results.errors[0].message);
  t.is(res.body.results.errors[0].message, 'Missing required property: email');
});

test('register: Swagger SCHEMA_VALIDATION_FAILED, password required', async (t) => {
  t.plan(6);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ email: 'test@gmail.com' });

  t.is(res.status, BAD_REQUEST);
  t.is(res.body.code, 'SCHEMA_VALIDATION_FAILED');
  t.truthy(res.body.results);
  t.truthy(res.body.results.errors);
  t.truthy(res.body.results.errors[0].message);
  t.is(res.body.results.errors[0].message, 'Missing required property: password');
});

test.serial('register: Email is taken', async (t) => {
  t.plan(1);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ email: 'testemail123456@mailinator.com', password: '123456789test1' });

  t.is(res.status, BAD_REQUEST);
});

test.serial('login: Success', async (t) => {
  t.plan(8);

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: 'testemail123456@mailinator.com', password: '123456789test' });

  t.is(res.status, SUCCESS);
  t.truthy(res.body.data);
  t.truthy(res.body.data.accessToken);
  t.truthy(res.body.data.refreshToken);

  t.log('refresh:token: Success');

  const res1 = await request(app)
    .post(REFRESH_TOKEN_ROUTE)
    .set('x-refresh-token', res.body.data.refreshToken)
    .send({});

  t.is(res1.status, SUCCESS);
  t.truthy(res1.body.data);
  t.truthy(res1.body.data.accessToken);
  t.truthy(res1.body.data.refreshToken);
});

test.serial('login: Wrong email', async (t) => {
  t.plan(2);

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: 'wrong_email@gmail.com', password: 'wrong_password' });

  t.is(res.status, BAD_REQUEST);
  t.is(res.body.message, 'Incorrect email.');
});

test.serial('login: Wrong password', async (t) => {
  t.plan(2);

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: 'testemail123456@mailinator.com', password: 'wrong_password' });

  t.is(res.status, BAD_REQUEST);
  t.is(res.body.message, 'Incorrect password.');
});

test.cb('passport:github', (t) => {
  t.plan(5);
  passport.githubStrategyCallback(null, null, { id: '123456', emails: [{ value: 'testemail123456@mailinator.com', primary: true }] }, (err, user) => {
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
  passport.twitterStrategyCallback(null, null, { id: '654321', emails: [{ value: 'testemail123456@mailinator.com' }] }, (err, user) => {
    t.is(err, null);
    t.truthy(user);
    t.is(user.twitterId, '654321');
    t.is(user.email, 'testemail123456@mailinator.com');
    t.pass();
    t.end();
  });
});

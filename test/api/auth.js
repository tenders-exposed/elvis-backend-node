'use strict';

const app = require('../../server');
const request = require('supertest');
const test = require('ava').test;
const helpers = require('../helpers');

const SUCCESS = 200;
const BAD_REQUEST = 400;
const REGISTER_ROUTE = '/auth/register';
const LOGIN_ROUTE = '/auth/login';
const REFRESH_TOKEN_ROUTE = '/auth/token/refresh';

let refreshToken;

test.before('Create DB', () => helpers.createDB());
test.after('Truncate DB', () => { helpers.truncateDB(); });

test.serial('register: Validation error, email pattern', async (t) => {
  t.plan(2);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ email: 'testemail123456', password: '123456789test' });

  t.is(res.status, BAD_REQUEST);
  t.regex(res.body.message, /^Validation error/);
});

test.serial('register: Swagger SCHEMA_VALIDATION_FAILED, email required', async (t) => {
  t.plan(2);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ password: '123456789test' });

  t.is(res.status, BAD_REQUEST);
  t.is(res.body.code, 'SCHEMA_VALIDATION_FAILED');
});

test.serial('register: Swagger SCHEMA_VALIDATION_FAILED, password required', async (t) => {
  t.plan(2);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ email: 'test@gmail.com' });

  t.is(res.status, BAD_REQUEST);
  t.is(res.body.code, 'SCHEMA_VALIDATION_FAILED');
});


test.serial('register: Success', async (t) => {
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

test.serial('register: Email is taken', async (t) => {
  t.plan(1);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({ email: 'testemail123456@mailinator.com', password: '123456789test1' });
  t.is(res.status, BAD_REQUEST);
});

test.serial('login: Success', async (t) => {
  t.plan(4);

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: 'testemail123456@mailinator.com', password: '123456789test' });

  refreshToken = res.body.data.refreshToken;
  t.is(res.status, SUCCESS);
  t.truthy(res.body.data);
  t.truthy(res.body.data.accessToken);
  t.truthy(res.body.data.refreshToken);
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

test.serial('refresh:token: Success', async (t) => {
  t.plan(4);

  const res = await request(app)
    .post(REFRESH_TOKEN_ROUTE)
    .set('x-refresh-token', refreshToken)
    .send({});

  t.is(res.status, SUCCESS);
  t.truthy(res.body.data);
  t.truthy(res.body.data.accessToken);
  t.truthy(res.body.data.refreshToken);
});

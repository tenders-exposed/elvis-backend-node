'use strict';

const _ = require('lodash');
const request = require('supertest');
const test = require('ava').test;
const helpers = require('../../helpers');
const app = require('../../../server');
const config = require('../../../config/default');
const AuthController = require('../../../api/controllers/AuthController');

const SUCCESS = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const REGISTER_ROUTE = '/account';
const LOGIN_ROUTE = '/account/login';
const REFRESH_TOKEN_ROUTE = '/account/token/refresh';

test.before('Create DB', () => helpers.createDB());
test.afterEach.always(() => helpers.truncateDB());

test.serial('createAccount: Success', async (t) => {
  t.plan(3);

  const userCreds = {
    email: 'testemail123456@mailinator.com',
    password: '123456789test',
  };
  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send(userCreds);
  t.is(res.status, CREATED);
  t.is(res.body.email, userCreds.email);

  const createdUser = await config.db.select()
    .from('User')
    .where({ email: userCreds.email })
    .one();
  t.is(createdUser.id, res.body.id);
});

test('createAccount: Validation error - email pattern', async (t) => {
  t.plan(4);

  const userCreds = {
    email: 'testemail123456',
    password: '123456789test',
  };
  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send(userCreds);
  t.is(res.status, BAD_REQUEST);
  t.regex(res.body.errors[0].message, /validation/i);
  t.regex(res.body.errors[0].message, /email/i);

  const writtenUser = await config.db.select()
    .from('User')
    .where({ email: userCreds.email })
    .one();
  t.is(writtenUser, undefined);
});

test('createAccount: Validation error - required', async (t) => {
  t.plan(5);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send({});
  t.is(res.status, BAD_REQUEST);
  t.is(res.body.errors.length, 2);

  const errorMessages = _.sortBy(_.map(res.body.errors, 'message'));
  t.regex(errorMessages[0], /missing/i);
  t.regex(errorMessages[0], /email/i);
  t.regex(errorMessages[1], /password/i);
});

test.serial('createAccount: Email is taken', async (t) => {
  t.plan(3);
  const userCreds = {
    email: 'testemail123456@mailinator.com',
    password: '123456789test',
  };
  const existingUser = await config.db.class.get('User')
    .then((U) => U.create(Object.assign(userCreds, { id: 'lololo' })));
  t.is(existingUser.email, userCreds.email);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send(userCreds);

  t.is(res.status, BAD_REQUEST);
  t.regex(res.body.errors[0].message, /taken/i);
});

test.serial('getAccount returns the account associated with tokens', async (t) => {
  t.plan(2);
  const userAttrs = {
    id: 'alabala',
    active: true,
    email: 'testemail123456@mailinator.com',
    password: await AuthController.createPasswordHash('123456789test'),
  };
  const completeUser = await AuthController.createTokenPair({ id: userAttrs.id })
    .then((tokens) => Object.assign(userAttrs, {
      accessTokens: [tokens.accessToken],
      refreshTokens: [tokens.refreshToken],
    }));
  await config.db.class.get('User')
    .then((User) => User.create(completeUser));

  const res = await request(app)
    .get(REGISTER_ROUTE)
    .set('x-access-token', completeUser.accessTokens[0])
    .set('x-refresh-token', completeUser.refreshTokens[0]);

  t.is(res.status, SUCCESS);
  t.is(res.body.id, userAttrs.id);
});

test.serial('login: Success', async (t) => {
  t.plan(3);
  const userCreds = {
    email: 'testemail123456@mailinator.com',
    password: '123456789test',
  };
  const userAttrs = Object.assign(JSON.parse(JSON.stringify(userCreds)), {
    id: 'alabala',
    active: true,
    password: await AuthController.createPasswordHash(userCreds.password),
  });
  await config.db.class.get('User')
    .then((U) => U.create(userAttrs));

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send(userCreds);
  t.is(res.status, SUCCESS);
  t.truthy(res.body.accessToken);
  t.truthy(res.body.refreshToken);
});

test.serial('login: Wrong email', async (t) => {
  t.plan(3);

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: 'wrong_email@gmail.com', password: 'wrong_password' });

  t.is(res.status, BAD_REQUEST);
  t.regex(res.body.errors[0].message, /incorrect/i);
  t.regex(res.body.errors[0].message, /email/i);
});

test.serial('login: Wrong password', async (t) => {
  t.plan(3);
  const userCreds = {
    email: 'testemail123456@mailinator.com',
    active: true,
    password: await AuthController.createPasswordHash('123456789test'),
  };
  await config.db.class.get('User')
    .then((User) => User.create(userCreds));

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: userCreds.email, password: 'wrong_password' });

  t.is(res.status, BAD_REQUEST);
  t.regex(res.body.errors[0].message, /incorrect/i);
  t.regex(res.body.errors[0].message, /password/i);
});

test.serial('login: Wrong password', async (t) => {
  t.plan(3);
  const userCreds = {
    email: 'testemail123456@mailinator.com',
    active: true,
    password: await AuthController.createPasswordHash('123456789test'),
  };
  await config.db.class.get('User')
    .then((User) => User.create(userCreds));

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: userCreds.email, password: 'wrong_password' });

  t.is(res.status, BAD_REQUEST);
  t.regex(res.body.errors[0].message, /incorrect/i);
  t.regex(res.body.errors[0].message, /password/i);
});

test.serial('refreshToken: Success', async (t) => {
  t.plan(5);
  const userAttrs = {
    id: 'lololo',
    email: 'testemail123456@mailinator.com',
    password: await AuthController.createPasswordHash('123456789test'),
    active: true,
  };
  const tokens = await AuthController.createTokenPair({ userId: userAttrs.userId });
  userAttrs.refreshTokens = [tokens.refreshToken];
  userAttrs.accessTokens = [tokens.accessToken];
  await config.db.class.get('Users')
    .then((Users) => Users.create(userAttrs));

  const res = await request(app)
    .get(REFRESH_TOKEN_ROUTE)
    .set('x-refresh-token', tokens.refreshToken)
    .send({});

  t.is(res.status, SUCCESS);
  t.truthy(res.body.accessToken);
  t.truthy(res.body.refreshToken);
  t.not(res.body.refreshToken, tokens.refreshToken);
  t.not(res.body.accessToken, tokens.accessToken);
});

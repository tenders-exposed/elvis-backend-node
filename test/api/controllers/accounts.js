'use strict';

const _ = require('lodash');
const request = require('supertest');
const test = require('ava');
const uuidv4 = require('uuid/v4');
const helpers = require('../../helpers');
const codes = require('../../../api/helpers/codes');
const app = require('../../../server');
const config = require('../../../config/default');
const AuthHelper = require('../../../api/helpers/auth');

const REGISTER_ROUTE = '/account';
const LOGIN_ROUTE = '/account/login';
const RESET_PASSWORD_ROUTE = '/account/password/reset';

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
  t.is(res.status, codes.CREATED);
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
  t.is(res.status, codes.BAD_REQUEST);
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
  t.is(res.status, codes.BAD_REQUEST);
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
  const existingUser = await config.db.create('vertex', 'User')
    .set(Object.assign({ id: uuidv4() }, userCreds))
    .commit()
    .one();
  t.is(existingUser.email, userCreds.email);

  const res = await request(app)
    .post(REGISTER_ROUTE)
    .send(userCreds);

  t.is(res.status, codes.BAD_REQUEST);
  t.regex(res.body.errors[0].message, /taken/i);
});

test.serial('getAccount returns the account associated with tokens', async (t) => {
  t.plan(2);
  const user = await helpers.createUser();

  const res = await request(app)
    .get(REGISTER_ROUTE)
    .set('Authorization', user.accessTokens[0])
    .set('X-Refresh-Token', user.refreshTokens[0]);

  t.is(res.status, codes.SUCCESS);
  t.is(res.body.id, user.id);
});

test.serial('login: Success', async (t) => {
  t.plan(3);
  const userCreds = {
    email: 'testemail123456@mailinator.com',
    password: '123456789test',
  };
  const userAttrs = Object.assign(JSON.parse(JSON.stringify(userCreds)), {
    id: uuidv4(),
    active: true,
    password: await AuthHelper.createPasswordHash(userCreds.password),
  });
  await config.db.create('vertex', 'User')
    .set(userAttrs)
    .commit()
    .one();

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send(userCreds);
  t.is(res.status, codes.SUCCESS);
  t.truthy(res.body.accessToken);
  t.truthy(res.body.refreshToken);
});

test.serial('login: Wrong email', async (t) => {
  t.plan(3);

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: 'wrong_email@gmail.com', password: 'wrong_password' });

  t.is(res.status, codes.BAD_REQUEST);
  t.regex(res.body.errors[0].message, /user/i);
  t.regex(res.body.errors[0].message, /found/i);
});

test.serial('login: Wrong password', async (t) => {
  t.plan(3);
  const userCreds = {
    id: uuidv4(),
    email: 'testemail123456@mailinator.com',
    active: true,
    password: await AuthHelper.createPasswordHash('123456789test'),
  };
  await config.db.create('vertex', 'User')
    .set(userCreds)
    .commit()
    .one();

  const res = await request(app)
    .post(LOGIN_ROUTE)
    .send({ email: userCreds.email, password: 'wrong_password' });

  t.is(res.status, codes.BAD_REQUEST);
  t.regex(res.body.errors[0].message, /incorrect/i);
  t.regex(res.body.errors[0].message, /password/i);
});

test.serial('resetPassword: Success updates the password', async (t) => {
  t.plan(2);
  const initialPassword = 'lololo';
  const userAttrs = {
    id: uuidv4(),
    active: true,
    email: 'testemail123456@mailinator.com',
    password: await AuthHelper.createPasswordHash(initialPassword),
  };
  await config.db.create('vertex', 'User')
    .set(userAttrs)
    .commit()
    .one();
  const requestAttrs = {
    password: '123456789test',
    resetPasswordToken: await AuthHelper.createToken({ email: userAttrs.email }),
  };

  const res = await request(app)
    .post(RESET_PASSWORD_ROUTE)
    .send(requestAttrs);

  const updatedUser = await config.db.select().from('User')
    .where({ email: userAttrs.email })
    .one();
  t.is(res.status, codes.NO_CONTENT);
  const check = await AuthHelper.verifyPassword(requestAttrs.password, updatedUser.password);
  t.is(check, true);
});

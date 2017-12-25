'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const passport = require('passport');

const config = require('../../config/default');
const codes = require('../helpers/codes');
const formatError = require('../helpers/errorFormatter');
const validateToken = require('../middlewares/validateToken');
const AuthController = require('./AuthController');
const MailGun = require('../classes/MailGun');

function createAccount(req, res) {
  const userAttrs = {};
  const userEmail = req.swagger.params.body.value.email;
  return config.db.select().from('User')
    .where({
      email: userEmail,
    })
    .one()
    .then((user) => {
      if (user) {
        throw codes.BadRequest('The email address is already taken.');
      }
      return AuthController.createPasswordHash(req.swagger.params.body.value.password);
    })
    .then((passwordHash) => {
      userAttrs.password = passwordHash;
      return config.db.class.get('User');
    })
    .then((User) => {
      userAttrs.id = uuidv4();
      userAttrs.email = userEmail;
      return User.create(userAttrs);
    })
    .then((user) => {
      res.status(codes.CREATED).json(_.pick(user, ['id', 'email']));
      return user;
    })
    .catch((err) => formatError(err, req, res))
    .then((user) => AuthController.createToken(
      { id: user.id },
      config.activation.expire,
    ))
    .then((token) => {
      if (process.env.NODE_ENV !== 'test') {
        return MailGun.sendEmail({
          to: userEmail,
          subject: 'Registration',
          text: `Thanks for registration. To activate your email please follow the link: \n ${config.activation.link}?t=${token}`,
        });
      }
      return null;
    })
    .catch((err) => console.error('Error sending activation email:', err));
}

function getAccount(req, res) {
  return validateToken(req, res, () =>
    res.status(codes.SUCCESS).json(_.pick(req.user, ['id', 'email', 'twitterId', 'githubId', 'active'])))
}

function deleteAccount(req, res) {
  return validateToken(req, res, () =>
    config.db.delete().from('User')
      .where({ id: req.user.id }).one()
      .then(() => res.status(codes.NO_CONTENT).json())
      .catch((err) => formatError(err, req, res)));
}

function login(req, res) {
  return passport.authenticate('local', (err, user) => {
    if (err) {
      return formatError(err, req, res);
    }
    req.user = user;
    return AuthController.createSession(req)
      .then((tokens) => res.status(codes.SUCCESS).json(tokens))
      .catch((err2) => formatError(err2, req, res));
  })(req, res);
}

module.exports = {
  login,
  getAccount,
  deleteAccount,
  createAccount,
};

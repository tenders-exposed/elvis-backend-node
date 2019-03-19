'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const passport = require('passport');

const config = require('../../config/default');
const codes = require('../helpers/codes');
const formatError = require('../helpers/errorFormatter');
const validateToken = require('../middlewares/validateToken');
const AuthHelper = require('../helpers/auth');
const MailGun = require('../../services/MailGun');
const userSerializer = require('../serializers/user');

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
        throw new codes.BadRequestError('The email address is already taken.');
      }
      return AuthHelper.createPasswordHash(req.swagger.params.body.value.password);
    })
    .then((passwordHash) => {
      userAttrs.password = passwordHash;
      userAttrs.id = uuidv4();
      userAttrs.email = userEmail;
      return config.db.create('vertex', 'User')
        .set(userAttrs)
        .commit()
        .one();
    })
    .then((user) => {
      res.status(codes.CREATED).json(_.pick(user, ['id', 'email']));
      return user;
    })
    .catch((err) => formatError(err, req, res))
    .then((user) => AuthHelper.createToken(
      { id: user.id },
      config.activation.expire,
    ))
    .then((token) => {
      if (config.env !== 'testing') {
        return new MailGun().sendEmail({
          to: userEmail,
          subject: 'Registration',
          text: `Thanks for registration. To activate your account follow this link: ${config.activation.externalUrl}${token} \n or this link to activate through the API: ${config.activation.url}?t=${token}`,
        });
      }
      return null;
    })
    .catch((err) => console.error('Error sending activation email:', err)); // eslint-disable-line no-console
}

function activateAccount(req, res) {
  const token = req.swagger.params.t.value;
  return AuthHelper.verifyToken(token)
    .then((decoded) => {
      if (!decoded.id) {
        throw new codes.BadRequestError('Wrong token.');
      }
      return config.db.select().from('User')
        .where({
          id: decoded.id,
        })
        .one();
    })
    .then((user) => {
      if (!user) {
        throw new codes.NotFoundError('User not found.');
      }
      if (user.active) {
        throw new codes.BadRequestError('User is already active.');
      }
      return config.db.update(user['@rid'])
        .set({ active: true })
        .return('AFTER')
        .one();
    })
    .then((user) =>
      res.status(codes.SUCCESS).json(userSerializer.formatUser(user)))
    .catch((err) => formatError(err, req, res));
}

function getAccount(req, res) {
  return validateToken(req, res, () =>
    res.status(codes.SUCCESS).json(userSerializer.formatUser(req.user)));
}

function deleteAccount(req, res) {
  return validateToken(req, res, () => {
    if (_.isUndefined(req.user) === false) {
      return config.db.vertex.delete(req.user)
        .then(() => res.status(codes.NO_CONTENT).json())
        .catch((err) => formatError(err, req, res));
    }
    return formatError(new codes.UnauthorizedError('This operation requires authorization.'), req, res);
  });
}

function login(req, res) {
  return passport.authenticate('local', (err, user) => {
    if (err) {
      return formatError(err, req, res);
    }
    req.user = user;
    return AuthHelper.createSession(req)
      .then((tokens) => res.status(codes.SUCCESS).json(tokens))
      .catch((err2) => formatError(err2, req, res));
  })(req, res);
}

function loginWithGithub(req, res) {
  return passport.authenticate('github')(req, res);
}

function loginWithTwitter(req, res) {
  return passport.authenticate('twitter')(req, res);
}

function refreshToken(req, res) {
  const refToken = req.swagger.params['X-Refresh-Token'].value;
  let foundUser;
  let newPair = {};
  return AuthHelper.verifyToken(refToken)
    .then((decoded) => {
      if (!decoded.id || decoded.type !== 'refresh_token') {
        throw new codes.BadRequestError('Wrong refresh token.');
      }
      return decoded;
    })
    .then((decoded) =>
      config.db.select().from('User')
        .where({
          id: decoded.id,
        })
        .one())
    .then((user) => {
      if (!user) {
        throw new codes.BadRequestError('Wrong refresh token.');
      }
      user.accessTokens = user.accessTokens || [];
      user.refreshTokens = user.refreshTokens || [];
      if (!user.refreshTokens.includes(refToken)) {
        throw new codes.BadRequestError('Wrong refresh token.');
      }
      foundUser = user;
      return AuthHelper.createTokenPair({ id: foundUser.id });
    })
    .then((pair) => {
      const ind = foundUser.refreshTokens.indexOf(refToken);
      foundUser.refreshTokens.splice(ind, 1);
      foundUser.refreshTokens.push(pair.refreshToken);
      foundUser.accessTokens.push(pair.accessToken);

      newPair = pair;
      return config.db.update(foundUser['@rid'])
        .set({ refreshTokens: foundUser.refreshTokens, accessTokens: foundUser.accessTokens })
        .one();
    })
    .then(() => res.status(200).json(newPair))
    .catch((err) => formatError(err, req, res));
}

function forgotPassword(req, res) {
  const email = req.swagger.params.email.value;

  if (!email) {
    return formatError(new codes.BadRequestError('Email is not provided.'), req, res);
  }
  return config.db.select('@rid', 'active').from('User')
    .where({
      email,
    })
    .one()
    .then((user) => {
      if (!user) {
        throw new codes.NotFoundError('User not found.');
      }
      if (!user.active) {
        throw new codes.BadRequestError('User is not active.');
      }
      return AuthHelper.createToken(
        { email },
        config.password.forgotToken.expire,
      );
    })
    .then((token) => {
      res.status(codes.NO_CONTENT).json();
      return token;
    })
    .catch((err) => formatError(err, req, res))
    .then((token) => {
      if (config.env !== 'testing') {
        return new MailGun().sendEmail({
          to: email,
          subject: 'Forgot password',
          text: `To reset your password please follow this link: ${config.password.reset.externalUrl}${token} \n or make a POST on ${config.password.reset.url} including the token.`,
        });
      }
      return null;
    })
    .catch((err) => console.error('Error sending reset password email:', err)); // eslint-disable-line no-console
}

function resetPassword(req, res) {
  const requestObject = req.swagger.params.body.value;
  let email;
  return AuthHelper.verifyToken(requestObject.resetPasswordToken)
    .then((decoded) => {
      if (!decoded.email) {
        throw new codes.BadRequestError('Wrong token.');
      } else {
        email = decoded.email;
      }
      return config.db.select('@rid').from('User')
        .where({
          email,
        })
        .one();
    })
    .then((user) => {
      if (!user) {
        throw new codes.NotFoundError('User not found.');
      }

      return AuthHelper.createPasswordHash(requestObject.password);
    })
    .then((passwordHash) => config.db.query(
      'UPDATE User SET password = :passwordHash WHERE email = :email',
      {
        params: {
          passwordHash,
          email,
        },
      },
    ))
    .then(() => res.status(codes.NO_CONTENT).json())
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  createAccount,
  activateAccount,
  getAccount,
  deleteAccount,
  login,
  loginWithGithub,
  loginWithTwitter,
  refreshToken,
  forgotPassword,
  resetPassword,
};

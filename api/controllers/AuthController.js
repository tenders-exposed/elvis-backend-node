'use strict';

const JWT = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const _ = require('lodash');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const authValidator = require('../validators/auth');
const MailGun = require('../classes/MailGun');

class AuthController {
  static register(req) {
    return new Promise((resolve, reject) => {
      let validRequestObject;
      authValidator.registerValidator(req.body)
        .then((validBody) => {
          validRequestObject = validBody;
          return config.db.select().from('Users')
            .where({
              email: validRequestObject.email,
            })
            .one();
        })
        .then((user) => {
          if (user) {
            throw codes.BadRequest('The email address is already taken.');
          }

          return AuthController.createPasswordHash(validRequestObject.password);
        })
        .then((passwordHash) => {
          validRequestObject.password = passwordHash;
          validRequestObject.regProvider = 'local';
          return config.db.class.get('Users');
        })
        .then((Users) => Users.create(validRequestObject))
        .then((user) => {
          validRequestObject.userId = user.rid || user['@rid'];
          return AuthController.createToken({
            userId: validRequestObject.userId,
          }, config.activation.expire);
        })
        .then((token) => MailGun.sendEmail({
          to: validRequestObject.email,
          subject: 'Registration',
          text: `Thanks for registration. To activate your email please follow the link: \n ${config.activation.link}?t=${token}`,
        }))
        .then(() => resolve(_.pick(validRequestObject, ['userId', 'email', 'regProvider'])))
        .catch(reject);
    });
  }
  static userActivation(req) {
    return new Promise((resolve, reject) => {
      const token = req.query.t;
      if (!token) {
        return reject(codes.BadRequest('Token is not provided.'));
      }
      return AuthController.verifyToken(token)
        .then((decoded) => {
          if (!decoded.userId) {
            throw codes.BadRequest('Wrong token.');
          }
          return config.db.select('@rid', 'active').from('Users')
            .where({
              '@rid': decoded.userId,
            })
            .one();
        })
        .then((user) => {
          if (!user) {
            throw codes.NotFound('User not found.');
          }
          if (user.active) {
            throw codes.BadRequest('User is already active.');
          }

          return config.db.update(user.rid).set({ active: true }).one();
        })
        .then(() => resolve())
        .catch(reject);
    });
  }

  static logout(req) {
    return new Promise((resolve, reject) => {
      // TODO remove tokens
      resolve();
    });
  }

  static refreshToken(req) {
    return new Promise((resolve, reject) => {
      const refreshToken = req.headers['x-refresh-token'];

      if (!refreshToken) {
        return reject(codes.BadRequest('Refresh token is not provided.'));
      }
      return JWT.verify(refreshToken, config.jwt.secret, (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return reject(codes.Unauthorized('Refresh token expired.'));
          }
          if (err.name === 'JsonWebTokenError') {
            return reject(codes.BadRequest(err.message));
          }
          return reject(codes.InternalServerError('The problem with refresh token check occurred.'));
        }

        if (!decoded.userId || decoded.type !== 'refresh_token') {
          return reject(codes.BadRequest('Wrong refresh token.'));
        }

        let newPair = {};
        let foundUser;
        return config.db.select().from('Users')
          .where({
            '@rid': decoded.userId,
          })
          .one()
          .then((user) => {
            if (!user) {
              throw codes.Unauthorized('No User.');
            }

            user.accessTokens = user.accessTokens || [];
            user.refreshTokens = user.refreshTokens || [];
            if (!user.refreshTokens.includes(refreshToken)) {
              throw codes.BadRequest('Wrong refresh token.');
            }
            foundUser = user;
            return AuthController.createTokenPair({ userId: decoded.userId });
          })
          .then((pair) => {
            const ind = foundUser.refreshTokens.indexOf(refreshToken);
            foundUser.refreshTokens.splice(ind, 1);
            foundUser.refreshTokens.push(pair.refreshToken);
            foundUser.accessTokens.push(pair.accessToken);

            newPair = pair;
            return config.db.update(decoded.userId)
              .set({ refreshTokens: foundUser.refreshTokens, accessTokens: foundUser.accessTokens })
              .one();
          })
          .then(() => resolve(newPair))
          .catch(reject);
      });
    });
  }

  static createSession(req) {
    return new Promise((resolve, reject) => {
      // console.log('Create session: ', req.user);
      const recordId = req.user.rid || req.user['@rid'];
      let session;
      AuthController.createTokenPair({ userId: recordId })
        .then((pair) => {
          session = pair;

          return config.db.query(
            'UPDATE Users ADD accessTokens = :accessToken, refreshTokens = :refreshToken WHERE @rid = :rid',
            {
              params: {
                rid: recordId,
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
              },
            },
          );
        })
        .then(() => resolve(session))
        .catch(reject);
    });
  }
  static createTokenPair(data) {
    return new Promise((resolve, reject) => {
      const session = {};
      data.type = 'access_token';
      AuthController.createToken(data, config.expire.accessToken)
        .then((accessToken) => {
          session.accessToken = accessToken;
          data.type = 'refresh_token';
          return AuthController.createToken(data, config.expire.refreshToken);
        })
        .then((refreshToken) => {
          session.refreshToken = refreshToken;
          resolve(session);
        })
        .catch(reject);
    });
  }

  static createToken(data, expire) {
    return new Promise((resolve, reject) => {
      const options = {};
      if (expire) {
        options.expiresIn = expire;
      }
      JWT.sign(data, config.jwt.secret, options, (err, token) => {
        if (err) {
          return reject(err);
        }
        return resolve(token);
      });
    });
  }

  static verifyToken(token) {
    return new Promise((resolve, reject) => {
      return JWT.verify(token, config.jwt.secret, (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return reject(codes.Unauthorized('Token expired.'));
          }

          if (err.name === 'JsonWebTokenError') {
            return reject(codes.BadRequest(err.message));
          }

          return reject(codes.InternalServerError('The problem with token check occurred.'));
        }

        resolve(decoded);
      });
    })
  }

  static createPasswordHash(password) {
    return new Promise((resolve, reject) => {
      bcrypt.genSalt(config.bcrypt.salt, (err, salt) => {
        if (err) {
          return reject(err);
        }
        return bcrypt.hash(password, salt, (err1, hash) => {
          if (err1) {
            return reject(err1);
          }
          return resolve(hash);
        });
      });
    });
  }

  static verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

module.exports = AuthController;

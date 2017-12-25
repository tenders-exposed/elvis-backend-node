'use strict';

const JWT = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const authValidator = require('../validators/auth');
const MailGun = require('../classes/MailGun');

class AuthController {
  static activateAccount(req) {
    return new Promise((resolve, reject) => {
      const token = req.query.t;
      if (!token) {
        return reject(codes.BadRequest('Token is not provided.'));
      }
      return AuthController.verifyToken(token)
        .then((decoded) => {
          if (!decoded.id) {
            throw codes.BadRequest('Wrong token.');
          }
          return config.db.select().from('User')
            .where({
              id: decoded.id,
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

          return config.db.update(user['@rid']).set({ active: true }).one();
        })
        .then(() => resolve())
        .catch(reject);
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

        if (!decoded.id || decoded.type !== 'refresh_token') {
          return reject(codes.BadRequest('Wrong refresh token.'));
        }

        let newPair = {};
        let foundUser;

        return config.db.select().from('User')
          .where({
            id: decoded.id,
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
            return AuthController.createTokenPair({ id: decoded.id });
          })
          .then((pair) => {
            const ind = foundUser.refreshTokens.indexOf(refreshToken);
            foundUser.refreshTokens.splice(ind, 1);
            foundUser.refreshTokens.push(pair.refreshToken);
            foundUser.accessTokens.push(pair.accessToken);

            newPair = pair;
            return config.db.update(foundUser.id)
              .set({ refreshTokens: foundUser.refreshTokens, accessTokens: foundUser.accessTokens })
              .one();
          })
          .then(() => resolve(newPair))
          .catch(reject);
      });
    });
  }
  static forgotPassword(req) {
    return new Promise((resolve, reject) => {
      const email = req.body.email;

      if (!email) {
        return reject(codes.BadRequest('Email is not provided.'));
      }
      return authValidator.emailValidator(email)
        .then(() => config.db.select('@rid', 'active').from('User')
          .where({
            email,
          })
          .one())
        .then((user) => {
          if (!user) {
            throw codes.NotFound('User not found.');
          }
          if (!user.active) {
            throw codes.BadRequest('User is not active.');
          }

          return AuthController.createToken({
            email,
          }, config.password.forgotToken.expire);
        })
        .then((token) => MailGun.sendEmail({
          to: email,
          subject: 'Forgot password',
          text: `To reset your password please follow the link: \n ${config.password.reset.link}?t=${token}`,
        }))
        .then(() => resolve())
        .catch(reject);
    });
  }
  static getPasswordReset(query) {
    return new Promise((resolve, reject) => {
      const token = query.t;
      let email;
      if (!token) {
        return reject(codes.BadRequest('Token is not provided.'));
      }
      return AuthController.verifyToken(token)
        .then((decoded) => {
          if (!decoded.email) {
            throw codes.BadRequest('Wrong token.');
          }
          email = decoded.email;
          return config.db.select('@rid').from('User')
            .where({
              email,
            })
            .one();
        })
        .then((user) => {
          if (!user) {
            throw codes.NotFound('User not found.');
          }
          resolve({
            token,
            email,
          });
        })
        .catch(reject);
    });
  }
  static passwordReset(req) {
    return new Promise((resolve, reject) => {
      let requestObject;
      return authValidator.resetPasswordValidator(req.body)
        .then((validRequestObject) => {
          requestObject = validRequestObject;
          return AuthController.getPasswordReset(validRequestObject);
        })
        .then((data) => {
          requestObject.email = data.email;
          if (requestObject.newPassword !== requestObject.confirmPassword) {
            throw codes.BadRequest('Passwords do not match.');
          }

          return AuthController.createPasswordHash(requestObject.newPassword);
        })
        .then((passwordHash) => config.db.query(
          'UPDATE User SET password = :passwordHash WHERE email = :email',
          {
            params: {
              passwordHash,
              email: requestObject.email,
            },
          },
        ))
        .then(() => resolve())
        .catch(reject);
    });
  }
  static createSession(req) {
    return new Promise((resolve, reject) => {
      let session;
      AuthController.createTokenPair({ id: req.user.id })
        .then((pair) => {
          session = pair;

          return config.db.query(
            'UPDATE User ADD accessTokens = :accessToken, refreshTokens = :refreshToken WHERE @rid = :rid',
            {
              params: {
                rid: req.user['@rid'],
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
    return new Promise((resolve, reject) => JWT.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return reject(codes.Unauthorized('Token expired.'));
        }

        if (err.name === 'JsonWebTokenError') {
          return reject(codes.BadRequest(err.message));
        }

        return reject(codes.InternalServerError('The problem with token check occurred.'));
      }

      return resolve(decoded);
    }));
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

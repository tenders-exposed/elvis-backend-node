'use strict';

const JWT = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const codes = require('../helpers/codes');
const config = require('../../config');

class AuthController {
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
      JWT.verify(refreshToken, config.jwt.secret, (err, decoded) => {
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
        config.db.select().from('Users')
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

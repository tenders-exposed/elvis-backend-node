'use strict';

const JWT = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const codes = require('../helpers/codes');
const config = require('../../config/default');

class AuthController {
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
    return new Promise((resolve, reject) =>
      JWT.verify(token, config.jwt.secret, (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return reject(codes.Unauthorized('Token expired.'));
          }

          if (err.name === 'JsonWebTokenError') {
            return reject(codes.BadRequest(err.message));
          }

          return reject(codes.InternalServerError('There was a problem checking the refresh token.'));
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

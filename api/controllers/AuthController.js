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

  static refreshToken(req, res) {
    return new Promise((resolve, reject) => {
      const accessToken = req.headers['x-access-token'];
      const refreshToken = req.headers['x-refresh-token'];

      if (!accessToken) {
        return reject(codes.BadRequest('Access token is not provided.'), res);
      }

      if (!refreshToken) {
        return reject(codes.BadRequest('Refresh token is not provided.'), res);
      }

      // TODO check refresh token and create new Pair
      return resolve();
    });
  }

  static createSession(req) {
    return new Promise((resolve, reject) => {
      console.log('Create session: ', req.user);

      const session = {};
      AuthController.createToken({ userId: req.user['@rid'], type: 'access_token' }, config.expire.accessToken)
        .then((accessToken) => {
          session.accessToken = accessToken;
          return AuthController.createToken({ userId: req.user['@rid'], type: 'refresh_token' }, config.expire.refreshToken);
        })
        .then((refreshToken) => {
          session.refreshToken = refreshToken;

          return config.db.query(
            'UPDATE Users ADD accessTokens = :accessToken, refreshTokens = :refreshToken WHERE @rid = rid',
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

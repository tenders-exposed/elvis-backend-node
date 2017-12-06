'use strict';

const codes = require('../helpers/codes');

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
      // TODO create tokens and save in db with expirations
      resolve({
        accessToken: AuthController.createToken(),
        refreshToken: AuthController.createToken(),
      });
    });
  }

  static createToken() {
    let j;
    let t = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYabcdefghijklmnopqrstuvwxyz0123456789';
    for (j = 0; j < 55; j += 1) {
      t += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return `${t}Z${new Date().getTime().toString(36)}`;
  }
}

module.exports = AuthController;

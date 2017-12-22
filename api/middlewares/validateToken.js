'use strict';

const _ = require('lodash');
const JWT = require('jsonwebtoken');
const config = require('../../config/default');
const sendResponse = require('../helpers/response');
const codes = require('../helpers/codes');

module.exports = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split('Bearer ')[1];

    if (token) {
      return JWT.verify(token, config.jwt.secret, (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return sendResponse(codes.Unauthorized('Access token expired.'), req, res);
          }

          if (err.name === 'JsonWebTokenError') {
            return sendResponse(codes.BadRequest(err.message), req, res);
          }

          return sendResponse(codes.InternalServerError('The problem with access token check occurred.'), req, res);
        }

        if (!decoded.id || decoded.type !== 'access_token') {
          return sendResponse(codes.BadRequest('Wrong access token.'), req, res);
        }

        return config.db.select().from('User')
          .where({
            id: decoded.id,
          })
          .one()
          .then((user) => {
            if (user && user.accessTokens && user.accessTokens.includes(token)) {
              req.user = _.pick(user, ['id', 'email', 'accessTokens', 'refreshTokens', 'twitterId', 'githubId', 'active']);
              return next();
            }

            return sendResponse(codes.Unauthorized('No User.'), req, res);
          })
          .catch((error) => sendResponse(codes.InternalServerError(error), req, res));
      });
    }
  }

  return sendResponse(codes.Unauthorized('No Access Token.'), req, res);
};

'use strict';

const JWT = require('jsonwebtoken');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');
const codes = require('../helpers/codes');

module.exports = (req, res, next) => {
  const token = req.swagger.params.Authorization.value;

  if (token) {
    return JWT.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return formatError(codes.Unauthorized('Access token expired.'), req, res);
        }

        if (err.name === 'JsonWebTokenError') {
          return formatError(codes.BadRequest(err.message), req, res);
        }

        return formatError(codes.InternalServerError('There was a problem checking the access token.'), req, res);
      }

      if (!decoded.id || decoded.type !== 'access_token') {
        return formatError(codes.BadRequest('Wrong access token.'), req, res);
      }

      return config.db.select().from('User')
        .where({
          id: decoded.id,
        })
        .one()
        .then((user) => {
          if (user && user.accessTokens && user.accessTokens.includes(token)) {
            req.user = user;
            return next();
          }

          return formatError(codes.Unauthorized('User not found.'), req, res);
        })
        .catch((error) => formatError(codes.InternalServerError(error), req, res));
    });
  }
  return next();
};

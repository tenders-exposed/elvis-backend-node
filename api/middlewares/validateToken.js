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
          return formatError(new codes.UnauthorizedError('Access token expired.'), req, res);
        }

        if (err.name === 'JsonWebTokenError') {
          return formatError(new codes.BadRequestError(err.message), req, res);
        }

        return formatError(new codes.InternalServerError('There was a problem checking the access token.'), req, res);
      }

      if (!decoded.id || decoded.type !== 'access_token') {
        return formatError(new codes.BadRequestError('Wrong access token.'), req, res);
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

          return formatError(new codes.UnauthorizedError('User not found.'), req, res);
        })
        .catch((error) => formatError(new codes.InternalServerError(error), req, res));
    });
  }
  return next();
};

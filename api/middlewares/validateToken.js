'use strict';

const JWT = require('jsonwebtoken');
const config = require('../../config');
const sendResponse = require('../helpers/response');
const codes = require('../helpers/codes');

module.exports = (req, res, next) => {
  if (req.headers.Authorization && req.headers.Authorization.startsWith('Bearer ')) {
    const token = req.headers.Authorization.split('Bearer ')[1];

    if (token) {
      JWT.verify(token, config.jwt.secret, (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            const errObj = codes.Unauthorized('Access token expired.');
            errObj.code = 'NO_SESSION';
            return sendResponse(errObj, req, res);
          }

          if (err.name === 'JsonWebTokenError') {
            return sendResponse(codes.BadRequest(err.message), req, res);
          }

          return sendResponse(codes.InternalServerError('The problem with access token check occured.'), req, res);
        }

        if (!decoded.userId || decoded.type !== 'access_token') {
          return sendResponse(codes.BadRequest('Wrong access token.'), req, res);
        }

        config.db.select().from('Users')
          .where({
            '@rid': decoded.userId,
          })
          .one()
          .then((user) => {
            console.log(user);
            if (user && user.accessTokens && user.accessTokens.includes(token)) {
              // TODO fill the sesion
              req.session = {};
              return next();
            }

            return sendResponse(codes.Unauthorized('No User.'), req, res);
          })
          .catch((error) => sendResponse(codes.InternalServerError(error), req, res));
      });
    }
  }

  sendResponse(codes.Unauthorized('No Access Token.'), req, res);
};

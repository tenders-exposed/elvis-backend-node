'use strict';

const sendResponse = require('../helpers/response');
const codes = require('../helpers/codes');

module.exports = (req, res, next) => {
  const token = req.headers['x-access-token'];

  if (token) {
    // TODO validate token
    return next();
  }

  sendResponse(codes.Unauthorized('No Access Token.'), req, res);
};

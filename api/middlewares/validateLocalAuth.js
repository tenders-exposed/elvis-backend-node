'use strict';

const sendResponse = require('../helpers/response');
const codes = require('../helpers/codes');
const authValidator = require('../validators/auth');

module.exports = (req, res, next) => {
  if (!req.body.email) {
    return sendResponse(codes.BadRequest('Email is required.'), req, res);
  }

  if (!req.body.password) {
    return sendResponse(codes.BadRequest('Password is required.'), req, res);
  }

  return authValidator.registerValidator(req.body)
    .then(() => next())
    .catch((err) => sendResponse(err, req, res));
};

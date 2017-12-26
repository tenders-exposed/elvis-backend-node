'use strict';

const config = require('../../config/default');
const codes = require('../helpers/codes');
const sendResponse = require('../helpers/errorFormatter');
const AuthController = require('./AuthController');

const forgotPassword = (req, res) => {
  AuthController.forgotPassword(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
};

const getPasswordReset = (req, res) => {
  AuthController.getPasswordReset(req.query)
    .then((data) => {
      res.redirect(`${config.password.reset.redirectUrl}&t=${data.token}&email=${data.email}`);
    })
    .catch((err) => {
      res.redirect(`${config.password.reset.redirectUrl}&err=${err.message || 'Something went wrong'}`);
    });
};

const passwordReset = (req, res) => {
  AuthController.passwordReset(req)
    .then(() => sendResponse(codes.Success(), req, res))
    .catch((err) => sendResponse(err, req, res));
};

module.exports = {
  forgotPassword,
  getPasswordReset,
  passwordReset,
};

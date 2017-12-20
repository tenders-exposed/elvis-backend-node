'use strict';

const config = require('../../config/default');
const passport = require('passport');
const codes = require('../helpers/codes');
const sendResponse = require('../helpers/response');
const AuthController = require('./AuthController');
const validateLocalAuthMiddleware = require('../middlewares/validateLocalAuth');

const register = (req, res) => {
  AuthController.register(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
};

const login = (req, res) => {
  validateLocalAuthMiddleware(req, res, (err1) => {
    if (err1) {
      return sendResponse(codes.InternalServerError(err1), req, res);
    }
    return passport.authenticate('local', (err, user) => {
      if (err) {
        return sendResponse(err, req, res);
      }

      if (!user) {
        return sendResponse(codes.NotFound('User not found.'), req, res);
      }

      req.user = user;

      return AuthController.createSession(req)
        .then((data) => sendResponse(codes.Success(data), req, res))
        .catch((err2) => sendResponse(err2, req, res));
    })(req, res);
  });
};

const refreshToken = (req, res) => {
  AuthController.refreshToken(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
};

const forgotPassword = (req, res) => {
  AuthController.forgotPassword(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
};

const getPasswordReset = (req, res) => {
  AuthController.getPasswordReset(req.query)
    .then((data) => {
      res.redirect(`${config.password.resetRedirectUrl}&t=${data.token}&email=${data.email}`);
    })
    .catch((err) => {
      res.redirect(`${config.password.resetRedirectUrl}&err=${err.message || 'Something went wrong'}`);
    });
};

const passwordReset = (req, res) => {
  AuthController.passwordReset(req)
    .then(() => sendResponse(codes.Success(), req, res))
    .catch((err) => sendResponse(err, req, res));
};

const loginWithGithub = (req, res) => {
  passport.authenticate('github', (err, user) => {
    if (err) {
      return sendResponse(err, req, res);
    }

    if (!user) {
      return sendResponse(codes.NotFound('User not found.'), req, res);
    }

    req.user = user;

    return AuthController.createSession(req)
      .then((data) => sendResponse(codes.Success(data), req, res))
      .catch((err1) => sendResponse(err1, req, res));
  })(req, res);
};

const loginWithTwitter = (req, res) => {
  passport.authenticate('twitter', (err, user) => {
    if (err) {
      return sendResponse(err, req, res);
    }

    if (!user) {
      return sendResponse(codes.NotFound('User not found.'), req, res);
    }

    req.user = user;

    return AuthController.createSession(req)
      .then((data) => sendResponse(codes.Success(data), req, res))
      .catch((err1) => sendResponse(err1, req, res));
  })(req, res);
};

module.exports = {
  register,
  login,
  refreshToken,
  loginWithGithub,
  loginWithTwitter,
  forgotPassword,
  getPasswordReset,
  passwordReset,
};

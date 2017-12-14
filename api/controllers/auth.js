'use strict';

const passport = require('passport');
const config = require('../../config/default');
const codes = require('../helpers/codes');
const sendResponse = require('../helpers/response');
const AuthController = require('./AuthController');
const validateLocalAuthMiddleware = require('../middlewares/validateLocalAuth');

const register = (req, res) => {
  AuthController.register(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
};

const activate = (req, res) => {
  AuthController.userActivation(req)
    .then(() => res.redirect(config.activation.redirectUrl))
    .catch((data) => res.json(data));
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
  activate,
  login,
  refreshToken,
  loginWithGithub,
  loginWithTwitter,
};

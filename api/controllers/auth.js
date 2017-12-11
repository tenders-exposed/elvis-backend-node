'use strict';

const passport = require('passport');
const config = require('../../config/default');
const AuthController = require('./AuthController');
const validateLocalAuthMiddleware = require('../middlewares/validateLocalAuth');

const register = (req, res) => {
  AuthController.register(req)
    .then((data) => res.json(data))
    .catch((data) => res.json(data));
};

const activate = (req, res) => {
  AuthController.userActivation(req)
    .then(() => res.redirect(config.activation.redirectUrl))
    .catch((data) => res.json(data));
};

const login = (req, res) => {
  validateLocalAuthMiddleware(req, res, (err1) => {
    if (err1) {
      return res.json(err1);
    }
    return passport.authenticate('local')(req, res, (err2) => {
      if (err2) {
        return res.json(err2);
      }
      return AuthController.createSession(req)
        .then((data) => res.json(data))
        .catch((err) => res.json(err));
    });
  });
};

const refreshToken = (req, res) => {
  AuthController.refreshToken(req)
    .then((data) => res.json(data))
    .catch((data) => res.json(data));
};

module.exports = {
  register,
  activate,
  login,
  refreshToken,
};

'use strict';

const express = require('express');
const passport = require('passport');
const validateToken = require('../../middlewares/validateToken');
const AuthController = require('../../controllers/AuthController');
const sendResponse = require('../../helpers/response');
const codes = require('../../helpers/codes');
const config = require('../../../config/default');

const router = express.Router();

router.post('/register', (req, res) => {
  AuthController.register(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
});

router.get('/register/activate', (req, res) => {
  AuthController.userActivation(req)
    .then((data) => {
      // sendResponse(codes.Success(data), req, res)
      res.redirect(config.activation.redirectUrl);
    })
    .catch((err) => {
      // sendResponse(err, req, res)
      res.redirect(`${config.activation.redirectUrl}?err${err.message || 'Something went wrong'}`);
    });
});

router.get('/login/twitter', passport.authenticate('twitter'), (req, res) => {
  if (req.user) {
    return sendResponse(codes.Success(req.user), req, res);
  }

  return sendResponse(codes.BadRequest('Wrong user.'), req, res);
});

router.get('/login/github', passport.authenticate('github'), (req, res) => {
  if (req.user) {
    return sendResponse(codes.Success(req.user), req, res);
  }

  return sendResponse(codes.BadRequest('Wrong user.'), req, res);
});

router.get('/login/twitter/callback', passport.authenticate('twitter'), (req, res) => {
  AuthController.createSession(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
});

router.get('/login/github/callback', passport.authenticate('github'), (req, res) => {
  AuthController.createSession(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
});

router.post('/logout', validateToken, (req, res) => {
  AuthController.logout(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
});

router.post('/token/refresh', (req, res) => {
  AuthController.refreshToken(req)
    .then((data) => sendResponse(codes.Success(data), req, res))
    .catch((err) => sendResponse(err, req, res));
});

module.exports = router;

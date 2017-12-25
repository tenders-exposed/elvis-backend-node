'use strict';

const express = require('express');
const passport = require('passport');
const AuthController = require('../controllers/AuthController');
const sendResponse = require('../helpers/errorFormatter');
const codes = require('../helpers/codes');
const config = require('../../config/default');

const router = express.Router();

router.get(config.activation.route, (req, res) => {
  AuthController.activateAccount(req)
    .then(() => {
      res.redirect(config.activation.redirectUrl);
    })
    .catch((err) => {
      res.redirect(`${config.activation.redirectUrl}?err=${err.message || 'Something went wrong'}`);
    });
});

router.get(config.passport.twitter.callbackRoute, passport.authenticate('twitter'), (req, res) => {
  AuthController.createSession(req)
    .then((tokens) => res.status(codes.SUCCESS).json(tokens))
    .catch((err) => sendResponse(err, req, res));
});

router.get(config.passport.github.callbackRoute, passport.authenticate('github'), (req, res) => {
  AuthController.createSession(req)
    .then((tokens) => res.status(codes.SUCCESS).json(tokens))
    .catch((err) => sendResponse(err, req, res));
});

module.exports = router;

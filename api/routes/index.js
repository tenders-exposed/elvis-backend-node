'use strict';

const express = require('express');
const passport = require('passport');
const AuthHelper = require('../helpers/auth');
const sendResponse = require('../helpers/errorFormatter');
const codes = require('../helpers/codes');
const config = require('../../config/default');

const router = express.Router();

router.get(config.passport.twitter.callbackRoute, passport.authenticate('twitter'), (req, res) => {
  AuthHelper.createSession(req)
    .then((tokens) => res.status(codes.SUCCESS).json(tokens))
    .catch((err) => sendResponse(err, req, res));
});

router.get(config.passport.github.callbackRoute, passport.authenticate('github'), (req, res) => {
  AuthHelper.createSession(req)
    .then((tokens) => res.status(codes.SUCCESS).json(tokens))
    .catch((err) => sendResponse(err, req, res));
});

module.exports = router;

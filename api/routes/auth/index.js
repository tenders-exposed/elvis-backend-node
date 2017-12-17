'use strict';

const express = require('express');
const passport = require('passport');
const validateToken = require('../../middlewares/validateToken');
const AuthController = require('../../controllers/AuthController');
const sendResponse = require('../../helpers/response');
const codes = require('../../helpers/codes');

const router = express.Router();

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

module.exports = router;

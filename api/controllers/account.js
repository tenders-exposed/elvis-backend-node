'use strict';

const _ = require('lodash');
const codes = require('../helpers/codes');
const sendResponse = require('../helpers/response');
const validateToken = require('../middlewares/validateToken');
const AccountController = require('./AccountController');

const getAccount = (req, res) => {
  validateToken(req, res, () => {
    sendResponse(codes.Success(_.pick(req.user, ['id', 'email', 'twitterId', 'githubId', 'active'])), req, res);
  });
};

const deleteAccount = (req, res) => {
  validateToken(req, res, () => {
    AccountController.deleteAccount(req)
      .then(() => sendResponse(codes.Success(), req, res))
      .catch((err) => sendResponse(err, req, res));
  });
};


module.exports = {
  getAccount,
  deleteAccount,
};

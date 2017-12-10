'use strict';

const Joi = require('joi');
const joiValidate = require('./index');
const config = require('../../config/default');

const registerSchema = Joi.object().keys({
  email: Joi.string().email().required().label('Email'),
  password: Joi.string().required().min(config.password.minLength),
});

exports.registerValidator = joiValidate(registerSchema);

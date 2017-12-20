'use strict';

const Joi = require('joi');
const joiValidate = require('./index');
const config = require('../../config/default');

const registerSchema = Joi.object().keys({
  email: Joi.string().email().required().label('Email'),
  password: Joi.string().required().min(config.password.minLength),
});

const resetPasswordSchema = Joi.object().keys({
  newPassword: Joi.string().required().min(config.password.minLength),
  confirmPassword: Joi.string().required().min(config.password.minLength),
  t: Joi.string().required().label('Token'),
});

const emailSchema = Joi.string().email().required().label('Email');

exports.registerValidator = joiValidate(registerSchema);
exports.emailValidator = joiValidate(emailSchema);
exports.resetPasswordValidator = joiValidate(resetPasswordSchema);

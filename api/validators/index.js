'use strict';

const Joi = require('joi');
const codes = require('../helpers/codes');

module.exports = (schema, options = { stripUnknown: true }) => (
  (obj) => (new Promise((resolve, reject) => {
    Joi.validate(obj, schema, options, (err, validatedData) => {
      if (err) {
        const errToSend = codes.BadRequest('Validation error', {
          error_info: err.toString(),
          error: err,
        });
        errToSend.details = [];
        err.details.forEach((e) => errToSend.details.push({ message: e.message, path: e.path }));
        return reject(errToSend);
      }
      return resolve(validatedData);
    });
  }))
);

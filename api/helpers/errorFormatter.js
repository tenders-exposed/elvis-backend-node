'use strict';

const _ = require('lodash');
const codes = require('./codes');
const config = require('../../config/default');

module.exports = (err, req, res) => {
  if (!req || !res) {
    throw new Error('You have forgotten to write req or res parameter in errorFormatter call.');
  }
  let errorResponse;

  if (err.status && err.message) {
    if (err.development) {
      if (config.env !== 'development') {
        delete err.development;
      } else if (err.development.error) {
        err.development.error_info = err.development.error.toString();
      }
    }
    errorResponse = err;
  } else {
    errorResponse = new codes.InternalServerError('Something went wrong...');
    errorResponse.error = err;
    errorResponse.error_info = err.toString();
  }

  console.error(errorResponse); // eslint-disable-line no-console
  return res.status(errorResponse.status).json({
    errors: [
      _.pick(errorResponse, ['message']),
    ],
  });
};

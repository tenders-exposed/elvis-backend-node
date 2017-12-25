'use strict';

const _ = require('lodash');
const codes = require('./codes');

module.exports = (err, req, res) => {
  if (!req || !res) {
    throw new Error('You have forgotten to write req or res parameter in errorFormatter call.');
  }
  let errorResponse;

  if (err.status && err.message) {
    if (err.development) {
      if (process.env.NODE_ENV !== 'development') {
        delete err.development;
      } else if (err.development.error) {
        err.development.error_info = err.development.error.toString();
      }
    }
    errorResponse = err;
  } else {
    errorResponse = codes.InternalServerError('Something went wrong...');
    errorResponse.error = err;
    errorResponse.error_info = err.toString();
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(errorResponse);
  }
  return res.status(errorResponse.status).json({
    errors: [
      _.pick(errorResponse, ['message']),
    ],
  });
};

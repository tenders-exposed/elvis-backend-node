'use strict';

const codes = require('./codes');

module.exports = (err, req, res) => {
  if (!req || !res) {
    throw new Error('You have forgotten to write req or res parameter in sendResponse call.');
  }

  if (err.status && err.message) {
    if (err.development) {
      if (process.env.NODE_ENV !== 'development') {
        delete err.development;
      } else if (err.development.error) {
        err.development.error_info = err.development.error.toString();
      }
    }
    return res.status(err.status).json(err);
  }

  const response = codes.InternalServerError('Something went wrong...');

  if (process.env.NODE_ENV === 'development') {
    response.error = err;
    response.error_info = err.toString();
  }

  return res.status(response.status).json(response);
};

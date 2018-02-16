'use strict';

const _ = require('lodash');
const util = require('util');

module.exports = function create() {
  return function errorFormatter(context, next) {
    if (!util.isError(context.error)) { return next(); }

    let errors;
    if (context.error.results) {
      errors = _.map(
        context.error.results.errors,
        (err) => _.pick(err, 'message'),
      );
    } else {
      errors = [{
        message: context.error.message,
      }];
    }
    const errorResponse = { errors };
    context.headers['Content-Type'] = 'application/json';
    console.error(context.error); // eslint-disable-line no-console
    delete context.error;
    return next(null, JSON.stringify(errorResponse));
  };
};

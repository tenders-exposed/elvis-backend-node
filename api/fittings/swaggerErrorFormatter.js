'use strict';

const _ = require('lodash');
const util = require('util');

module.exports = function create(fittingDef, bagpipes) {
  return function errorFormatter(context, next) {
    if (!util.isError(context.error)) { return next(); }

    const errors = _.map(
      context.error.results.errors,
      (err) => _.pick(err, 'message'),
    );
    const errorResponse = { errors };
    context.headers['Content-Type'] = 'application/json';
    delete context.error;
    return next(null, JSON.stringify(errorResponse));
  };
};

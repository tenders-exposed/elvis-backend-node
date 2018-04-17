'use strict';

const helper = require('../helpers/cors');

module.exports = function create() {
  return (context, next) => helper(context.request, context.response, next);
};

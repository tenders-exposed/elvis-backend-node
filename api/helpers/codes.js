'use strict';

const _ = require('lodash');

const SUCCESS = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const MULTIPLE_CHOICES = 300;
const MOVED_PERMANENTLY = 301;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const PAYMENT_REQUIRED = 402;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const METHOD_NOT_ALLOWED = 405;
const GONE = 410;
const TOO_MANY_REQUESTS = 429;
const UNAVAILABLE_FOR_LEGAL_REASONS = 451;
const INTERNAL_SERVER_ERROR = 500;
const NOT_IMPLEMENTED = 501;
const SERVICE_UNAVAILABLE = 503;

module.exports = {
  SUCCESS,
  CREATED,
  NO_CONTENT,
  MULTIPLE_CHOICES,
  MOVED_PERMANENTLY,
  BAD_REQUEST,
  UNAUTHORIZED,
  PAYMENT_REQUIRED,
  FORBIDDEN,
  NOT_FOUND,
  METHOD_NOT_ALLOWED,
  GONE,
  TOO_MANY_REQUESTS,
  UNAVAILABLE_FOR_LEGAL_REASONS,
  INTERNAL_SERVER_ERROR,
  NOT_IMPLEMENTED,
  SERVICE_UNAVAILABLE,
  success: {
    status: SUCCESS,
    message: 'Success',
  },
  created: {
    status: CREATED,
    message: 'Created',
  },
  noContent: {
    status: NO_CONTENT,
    message: 'The request was successfully fulfilled but there is no additional content',
  },
  badRequest: {
    status: BAD_REQUEST,
    message: 'The request could not be understood by the server due to malformed syntax. You SHOULD NOT repeat the request without modifications.',
  },
  unauthorized: {
    status: UNAUTHORIZED,
    message: 'Unauthorized, please log in first',
  },
  paymentRequired: {
    status: PAYMENT_REQUIRED,
    message: 'Payment required to continue',
  },
  forbidden: {
    status: FORBIDDEN,
    message: 'Insufficient permissions',
  },
  notFound: {
    status: NOT_FOUND,
    message: 'Not found',
  },
  methodNotAllowed: {
    status: METHOD_NOT_ALLOWED,
    message: 'Method not allowed',
  },
  gone: {
    status: GONE,
    message: 'Requested content has been removed from server',
  },
  tooManyRequests: {
    status: TOO_MANY_REQUESTS,
    message: 'Too many requests.',
  },
  unavailableForLegalReasons: {
    status: UNAVAILABLE_FOR_LEGAL_REASONS,
    message: 'Unavailable for legal reasons',
  },
  internalServerError: {
    status: INTERNAL_SERVER_ERROR,
    message: 'Oops, something went wrong',
  },
  notImplemented: {
    status: NOT_IMPLEMENTED,
    message: 'Not implemented',
  },
  serviceUnavailable: {
    status: SERVICE_UNAVAILABLE,
    message: 'Service unavailable, we are working hard to fix it asap',
  },
  getCode(response, data, message, development) {
    const res = _.clone(this[response]);
    if (data) {
      res.data = data;
    }
    if (message) {
      res.message = message;
    }
    if (development) {
      res.development = development;
    }

    return res;
  },
  Success(...args) {
    return this.getCode('success', ...args);
  },
  Created(...args) {
    return this.getCode('created', ...args);
  },
  NoContent(...args) {
    return this.getCode('noContent', ...args);
  },
  BadRequest(...args) {
    return this.getCode('badRequest', null, ...args);
  },
  Unauthorized(...args) {
    return this.getCode('unauthorized', null, ...args);
  },
  PaymentRequired(...args) {
    return this.getCode('paymentRequired', null, ...args);
  },
  Forbidden(...args) {
    return this.getCode('forbidden', null, ...args);
  },
  NotFound(...args) {
    return this.getCode('notFound', null, ...args);
  },
  MethodNotAllowed(...args) {
    return this.getCode('methodNotAllowed', null, ...args);
  },
  Gone(...args) {
    return this.getCode('gone', null, ...args);
  },
  UnavailableForLegalReasons(...args) {
    return this.getCode('unavailableForLegalReasons', null, ...args);
  },
  InternalServerError(...args) {
    return this.getCode('internalServerError', null, ...args);
  },
  ServiceUnavailable(...args) {
    return this.getCode('serviceUnavailable', null, ...args);
  },
  NotImplemented(...args) {
    return this.getCode('notImplemented', null, ...args);
  },
  TooManyRequests(...args) {
    return this.getCode('tooManyRequests', null, ...args);
  },
  Determine(response) {
    const fields = ['status', 'message', 'data', 'links', 'info', 'development'];
    let res;

    if (typeof response.status === 'undefined') {
      response.status = '';
    }

    switch (response.status) {
      case SUCCESS: {
        res = _.clone(this.success);
        fields.forEach((field) => {
          if (response[field]) {
            res[field] = response[field];
          }
        });
        break;
      }
      case CREATED: {
        res = _.clone(this.created);
        fields.forEach((field) => {
          if (response[field]) {
            res[field] = response[field];
          }
        });
        break;
      }
      default: {
        res = this.BadRequest('Wrong response given to Determine() method', {
          info: 'response should contain 200 or 201 status',
        });
        break;
      }
    }

    return res;
  },
};

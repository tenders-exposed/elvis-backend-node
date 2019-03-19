'use strict';

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

const defaultResponses = {
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
};

class DomainError extends Error {
  constructor(message) {
    super(message);
    // Ensure the name of this error is the same as the class name
    this.name = this.constructor.name;
    this.message = message;
    // This clips the constructor invocation from the stack trace.
    // It's not absolutely essential, but it does make the stack trace a little nicer.
    //  @see Node.js reference (bottom)
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends DomainError {
  constructor(message, query) {
    super(message);
    this.data = { query };
    this.status = defaultResponses.badRequest.status;
    this.message = message || defaultResponses.badRequest.message;
  }
}

class UnauthorizedError extends DomainError {
  constructor(message, query) {
    super(message);
    this.data = { query };
    this.status = defaultResponses.unauthorized.status;
    this.message = message || defaultResponses.unauthorized.message;
  }
}
class ForbiddenError extends DomainError {
  constructor(message, query) {
    super(message);
    this.data = { query };
    this.status = defaultResponses.forbidden.status;
    this.message = message || defaultResponses.forbidden.message;
  }
}

class NotFoundError extends DomainError {
  constructor(message, query) {
    super(message);
    this.data = { query };
    this.status = defaultResponses.notFound.status;
    this.message = message || defaultResponses.notFound.message;
  }
}

class InternalServerError extends DomainError {
  constructor(message, query) {
    super(message);
    this.data = { query };
    this.status = defaultResponses.internalServerError.status;
    this.message = message || defaultResponses.internalServerError.message;
  }
}

class ServiceUnavailableError extends DomainError {
  constructor(message, query) {
    super(message);
    this.data = { query };
    this.status = defaultResponses.serviceUnavailable.status;
    this.message = message || defaultResponses.serviceUnavailable.message;
  }
}

class NotImplementedError extends DomainError {
  constructor(message, query) {
    super(message);
    this.data = { query };
    this.status = defaultResponses.notImplemented.status;
    this.message = message || defaultResponses.notImplemented.message;
  }
}
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
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
  ServiceUnavailableError,
  NotImplementedError,
};

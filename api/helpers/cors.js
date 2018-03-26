'use strict';

const url = require('url');

module.exports = (req, res, next) => {
  let originURL = undefined;
  let origin = undefined;

  if (req.headers.referer) {
    originURL = url.parse(req.headers.referer);
    origin = `${originURL.protocol}//${originURL.hostname}`;
  } else if (req.headers.origin) {
    originURL = url.parse(req.headers.origin);
    origin = `${originURL.protocol}//${originURL.hostname}`;
  } else {
    origin = '*';
  }

  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-type,Accept,X-Refresh-Token,Authorization');
  res.header('Access-Control-Allow-Credentials', true);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return next();
};

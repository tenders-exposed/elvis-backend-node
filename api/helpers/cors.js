'use strict';

const url = require('url');

module.exports = (req, res, next) => {
  if (!req.headers.referer) {
    console.warn('No referer was sent', req.headers);
  }

  const originURL = url.parse(req.headers.referer);
  const originReferer = `${originURL.protocol}//${originURL.hostname}`;
  const originHeader = req.headers.origin;

  const origin = originHeader || originReferer || '*';

  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-type,Accept,X-Refresh-Token,Authorization');
  res.header('Access-Control-Allow-Credentials', true);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return next();
};

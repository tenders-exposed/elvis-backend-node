'use strict';

module.exports = function create() {
  return (context, next) => {
    const req = context.request;
    const res = context.response;

    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-type,Accept,X-Refresh-Token,Authorization');
    res.header('Access-Control-Allow-Credentials', true);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return next();
  };
};

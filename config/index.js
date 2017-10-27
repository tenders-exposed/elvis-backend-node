'use strict';

require('dotenv').config();
const OrientDB = require('orientjs');

// API
const config = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 10010,
  url: process.env.URL,
};
if (!config.url) {
  throw Error('Please set the URL environment variable to a URL like "http://www.foo.com:10010".');
}

// OrientDB
const orientDBConfig = {
  host: process.env.ORIENTDB_HOST,
  port: process.env.ORIENTDB_PORT,
  name: process.env.ORIENTDB_DB,
  username: process.env.ORIENTDB_USER,
  password: process.env.ORIENTDB_PASS,
};
config.db = new OrientDB.ODatabase(orientDBConfig);

module.exports = config;

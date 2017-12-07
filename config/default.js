'use strict';

require('dotenv').config();
const OrientDB = require('orientjs');
const YAML = require('yamljs');

const NODE_ENV = process.env.NODE_ENV;

// API
const config = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 10010,
};

// OrientDB
const orientDBConfig = {
  host: process.env.ORIENTDB_HOST,
  port: process.env.ORIENTDB_PORT,
  username: process.env.ORIENTDB_USER,
  password: process.env.ORIENTDB_PASS,
};
if (NODE_ENV === 'test') {
  orientDBConfig.name = process.env.ORIENTDB_TEST_DB;
  orientDBConfig.storage = 'memory';
} else {
  orientDBConfig.name = process.env.ORIENTDB_DB;
  orientDBConfig.storage = 'plocal';
}

config.db = new OrientDB.ODatabase(orientDBConfig);

// Migrations
const migrationsDir = `${__dirname}/../migrations`;

config.migrationManager = new OrientDB.Migration.Manager({
  db: config.db,
  dir: migrationsDir,
});

// Swagger
const swaggerConfigPath = `${__dirname}/swagger.yaml`;
Object.assign(config, YAML.load(swaggerConfigPath));
// Passport
config.passport = {
  github: {
    clientId: 'be1b9eaa54f2e13626fc',
    clientSecret: '82c1f213555de6154cd435f5c8e479f036bfef14',
    callbackUrl: `http://localhost:${config.port}/auth/login/github/callback`,
  },
  twitter: {
    apiKey: '01r9gu9YFPP6PLYwuTxMSRqUv',
    apiSecret: '8HzX2VERNE8Y3vpskad0QPBVFWC1FF2RptPrjtWuC9jMju3BM8',
    callbackUrl: `http://127.0.0.1:${config.port}/auth/login/twitter/callback`,
  },
};

config.jwt = {
  secret: 'fgWi6sHirxNul86gqBmWiCFcnud9iNz6YCsqALHlCMhn9Zjawx7785',
};

config.expire = {
  accessToken: 3600, // 1 hour
  refreshToken: 2592000, // 30 days
};

config.bcrypt = {
  salt: 10,
};

module.exports = config;

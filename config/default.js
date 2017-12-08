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

module.exports = config;

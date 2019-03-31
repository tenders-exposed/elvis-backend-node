'use strict';

require('dotenv').config();
const OrientDB = require('orientjs');
const YAML = require('yamljs');

// API
const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 10010,
  baseUrl: process.env.BASE_URL,
  session: {
    secret: process.env.SESSION_SECRET,
  },
};

// OrientDB
const orientDBConfig = {
  host: process.env.ORIENTDB_HOST,
  port: process.env.ORIENTDB_PORT,
  username: process.env.ORIENTDB_USER,
  password: process.env.ORIENTDB_PASS,
};
if (config.env === 'testing') {
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

// Oauth
config.passport = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackRoute: '/account/login/github/callback',
  },
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    callbackRoute: '/account/login/twitter/callback',
  },
};
config.passport.github.callbackUrl = `${config.baseUrl}${config.passport.github.callbackRoute}`;
config.passport.twitter.callbackUrl = `${config.baseUrl}${config.passport.twitter.callbackRoute}`;

// Swagger
const swaggerConfigPath = `${__dirname}/swagger.yaml`;
Object.assign(config, YAML.load(swaggerConfigPath));

// Security
config.jwt = {
  secret: process.env.JWT_SECRET,
};

config.expire = {
  accessToken: 86400, // 1 hour
  refreshToken: 2592000, // 30 days
};

config.bcrypt = {
  salt: 10,
};

config.password = {
  minLength: 6,
  forgotToken: {
    expire: 3600, // 1 hour
  },
  // Password reset
  reset: {
    url: `${config.baseUrl}/account/password/reset`,
    externalUrl: process.env.PASSWORD_RESET_URL,
  },
};

// Mail
config.mailgun = {
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
  from: process.env.MAILGUN_FROM || 'tech@tenders.exposed',
};

// Account activation
config.activation = {
  expire: 3600, // 1 hour
  url: `${config.baseUrl}/account/activate`,
  externalUrl: process.env.ACCOUNT_ACTIVATION_URL,
};

config.staticDataUrls = {
  cpvs: process.env.CPV_LIST_URL || 'https://raw.githubusercontent.com/tenders-exposed/data_sources/master/cpv_codes.json',
  militaryCpvs: process.env.MILITARY_CPV_LIST_URL || 'https://raw.githubusercontent.com/tenders-exposed/data_sources/master/military_cpv_codes.json',
  countries: process.env.COUNTRIES_LIST_URL || 'https://raw.githubusercontent.com/tenders-exposed/data_sources/master/countrynames_iso2_correspondence.json',
  directiveTenders: process.env.DIRECTIVE_TENDERS_LIST_URL || 'https://raw.githubusercontent.com/tenders-exposed/data_sources/master/ted_can_200981EC_directive.json',
};

module.exports = config;

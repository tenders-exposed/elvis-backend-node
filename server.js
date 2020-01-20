'use strict';

const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const logger = require('morgan');
const YAML = require('yamljs');
const SwaggerExpress = require('swagger-express-mw1');
const swaggerUi = require('swagger-ui-express');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const nonSwaggerRouter = require('./api/routes/index');
const config = require('./config/default');

const app = express();
const swaggerConfig = {
  appRoot: __dirname,
  swaggerSecurityHandlers: {
    twitterOauth: (req, def, scopes, callback) => {
      passport.authenticate('twitter', (err, user) => {
        if (err) {
          console.log('Error in Twitter authentication:', err); // eslint-disable-line no-console
          return callback(new Error('Error in passport authenticate'));
        }

        if (!user) {
          return callback(new Error('Failed to authenticate oAuth token'));
        }

        req.user = user;
        return callback();
      })(req, req.res, callback);
    },
    githubOauth: (req, def, scopes, callback) => {
      passport.authenticate('github', (err, user) => {
        if (err) {
          console.log('Error in GitHub authentication:', err); // eslint-disable-line no-console
          return callback(new Error('Error in passport authenticate'));
        }

        if (!user) {
          return callback(new Error('Failed to authenticate oAuth token'));
        }

        req.user = user;
        return callback();
      })(req, req.res, callback);
    },
  },
};

const swaggerDocument = YAML.load('./api/swagger/swagger.yaml');

// Event listener for HTTP server "error" event.
const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${config.port}` : `Port ${config.port}`;

  switch (error.code) {
    case 'EACCES':
      console.log('%s requires elevated privileges', bind); // eslint-disable-line no-console
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.log('%s is already in use', bind); // eslint-disable-line no-console
      process.exit(1);
      break;
    default:
      throw error;
  }
};


require('./passport').configureStrategies();

app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));
app.use(bodyParser.json({ limit: '200mb' }));
app.use(logger('dev'));

app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(nonSwaggerRouter);

SwaggerExpress.create(swaggerConfig, (err, swaggerExpress) => {
  swaggerExpress.register(app);

  let credentials;

  if (config.ssl && config.ssl.keyPath && config.ssl.certPath) {
    credentials = {
      key: fs.readFileSync(config.ssl.keyPath),
      cert: fs.readFileSync(config.ssl.certPath),
    };

    if (config.ssl.ca) {
      credentials.ca = fs.readFileSync(config.ssl.ca);
    }
  }

  const server = !credentials ? http.createServer(app) : https.createServer(credentials, app);
  server.listen(config.port);

  server.on('listening', () => {
    console.log(`Server is Listening on ${config.port}`); // eslint-disable-line no-console
  });

  server.on('error', onError);
});


module.exports = app; // for testing

'use strict';

const SwaggerExpress = require('swagger-express-mw');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const app = require('express')();
const fs = require('fs');
const http = require('http');
const https = require('https');
const logger = require('morgan');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const initRoutes = require('./api/routes');
const config = require('./config/default');

const swaggerConfig = {
  appRoot: __dirname,
};

SwaggerExpress.create(swaggerConfig, (err, swaggerExpress) => {
  if (err) { throw err; }

  // install middleware
  swaggerExpress.register(app);

  app.listen(config.port, config.host, () => console.log(`App listening on port ${config.port}`)); // eslint-disable-line no-console
});

const swaggerDocument = YAML.load('./api/swagger/swagger.yaml');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Event listener for HTTP server "error" event.
const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${config.port}` : `Port ${config.port}`;

  switch (error.code) {
    case 'EACCES':
      console.log('%s requires elevated privileges', bind);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.log('%s is already in use', bind);
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
app.all('/*', (req, res, next) => {
  // cors
  res.header('Access-Control-Allow-Origin', '*'); // TODO restrict to specified domain if necessary
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-type,Accept,X-Refresh-Token,Authorization');
  res.header('Access-Control-Allow-Credentials', true);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return next();
});
app.use(session({
  secret: '0$jdh-YsdnA3fiiH^5$w',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
}));
app.use(passport.initialize());
app.use(passport.session());

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
  console.log(`Server is Listening on ${config.port}`);
  initRoutes(app);
});

server.on('error', onError);

module.exports = app; // for testing

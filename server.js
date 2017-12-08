'use strict';

const config = require('config');
const SwaggerExpress = require('swagger-express-mw');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const app = require('express')();

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

module.exports = app; // for testing

'use strict';

const config = require('./config');
const Hapi = require('hapi');

const server = new Hapi.Server();
server.connection({ port: config.port, host: config.host });

server.start((err) => {
  if (err) {
    throw err;
  }
  console.info(`Server running at: ${server.info.uri}`); // eslint-disable-line no-console
});

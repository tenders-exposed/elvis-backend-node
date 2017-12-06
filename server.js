'use strict';

const config = require('./config');
const express = require('express');

const app = express();

app.listen(config.port, config.host, () => console.log(`App listening on port ${config.port}`)); // eslint-disable-line no-console

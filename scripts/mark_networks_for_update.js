/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');
const moment = require('moment');

const config = require('../config/default');
const helpers = require('./helpers');

function markNetworksForUpdte() {
  const currentTime =  moment().format('YYYY-MM-DD HH:mm:ss');
  const networksToUpdateQuery = `SELECT * FROM Network where updated < '${currentTime}'`;
  return config.db.query(networksToUpdateQuery)
    .then((networksToUpdate) => Promise.map(networksToUpdate, (network) =>
      config.db.update('Network')
      .set({
        xUpdateNeeded: true,
      })
      .where({ '@rid': network['@rid'] })
      .return('AFTER')
      .commit()
      .one()))
    .then((updatedNetworks) => {
      console.log(`Marked ${updatedNetworks.length} networks for update`);
      process.exit();
    })
      .catch((err) => {
        console.error(err);
        process.exit(-1);
      });
}

markNetworksForUpdte();

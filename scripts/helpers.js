'use strict';

const https = require('https');
const Promise = require('bluebird');

const codes = require('../api/helpers/codes');

function fetchRemoteFile(URL) {
  return new Promise((resolve, reject) => {
    https.get(URL, (res) => {
      const { statusCode } = res;
      if (statusCode !== codes.SUCCESS) {
        throw new Error(`Request failed with status code: ${statusCode}`);
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => resolve(JSON.parse(rawData)));
    }).on('error', (e) => {
      reject(e);
    });
  });
}

module.exports = {
  fetchRemoteFile,
};

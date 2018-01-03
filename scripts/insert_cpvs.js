/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const https = require('https');
const Promise = require('bluebird');

const config = require('../config/default');
const codes = require('../api/helpers/codes');

const cpvsURL = new URL('https://raw.githubusercontent.com/tenders-exposed/data_sources/master/cpv_codes.json');

function fetchCPVs() {
  return new Promise((resolve, reject) => {
    console.log('Fetching CPVs...');
    https.get(cpvsURL, (res) => {
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

function importCPVs() {
  fetchCPVs()
    .then((cpvList) => {
      console.log('Upserting CPVs...');
      return Promise.map(cpvList, (rawCpv) => {
        const cpv = {
          code: rawCpv.code,
          xName: rawCpv.text,
          xNumberDigits: rawCpv.number_digits,
        };
        return config.db.select().from('CPV')
          .where({ code: cpv.code })
          .one()
          .then((existingCpv) => {
            if (_.isUndefined(existingCpv)) {
              return config.db.create('vertex', 'CPV')
                .set(cpv)
                .commit()
                .one();
            }
            return config.db.update('CPV')
              .set(cpv)
              .where({ '@rid': existingCpv['@rid'] })
              .return('AFTER')
              .commit()
              .one();
          });
      });
    })
    .then((writtenCPVs) => {
      console.log(`Upserted ${writtenCPVs.length} CPVs`);
      process.exit();
    })
    .catch((err) => {
      console.error(err);
      process.exit(-1);
    });
}

importCPVs();

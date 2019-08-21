/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');

const config = require('../config/default');
const helpers = require('./helpers');

const cpvsURL = new URL('https://raw.githubusercontent.com/tenders-exposed/data_sources/master/cpv_codes.json');

function importCPVs() {
  helpers.fetchRemoteFile(cpvsURL)
    .then((cpvList) => {
      console.log('Upserting CPVs...');
      return Promise.map(cpvList, (rawCpv) => {
        const cpv = {
          code: rawCpv.code,
          xOriginalCode: rawCpv.code,
          xName: rawCpv.text,
          xNumberDigits: rawCpv.number_digits,
        };
        return config.db.select().from('CPV')
          .where({ xOriginalCode: cpv.code })
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

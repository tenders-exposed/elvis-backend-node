/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');

const config = require('../config/default');
const helpers = require('./helpers');

const cpvsURL = new URL('https://raw.githubusercontent.com/tenders-exposed/data_sources/master/cpv_codes.json');
const militaryCpvsURL = new URL('https://raw.githubusercontent.com/tenders-exposed/data_sources/master/military_cpv_codes.json');

function upsertCpv(cpvRecord) {
  return config.db.select().from('CPV')
    .where({ code: cpvRecord.code })
    .one()
    .then((existingCpv) => {
      if (_.isUndefined(existingCpv)) {
        return config.db.create('vertex', 'CPV')
          .set(cpvRecord)
          .commit()
          .one();
      }
      return config.db.update('CPV')
        .set(cpvRecord)
        .where({ '@rid': existingCpv['@rid'] })
        .return('AFTER')
        .commit()
        .one();
    });
}

function importMilitaryCpvs() {
  console.log('Retrieving military CPVs...');
  return helpers.fetchRemoteFile(militaryCpvsURL)
    .then((militaryCpvList) => {
      console.log('Retrieving all CPVs...');
      return helpers.fetchRemoteFile(cpvsURL)
        .then((cpvList) => {
          console.log('Upserting CPVs...');
          return Promise.map(cpvList, (rawCpv) => {
            const cpv = {
              code: rawCpv.code,
              xName: rawCpv.text,
              xNumberDigits: rawCpv.number_digits,
              military: !_.isUndefined(_.find(militaryCpvList, { code: rawCpv.code })),
            };
            return upsertCpv(cpv);
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

importMilitaryCpvs();

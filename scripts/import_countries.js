/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');

const config = require('../config/default');
const helpers = require('./helpers');

function importCountries() {
  helpers.fetchRemoteFile(new URL(config.staticDataUrls.countries))
    .then((countriesMapping) => {
      console.log('Upserting countries...');
      return Promise.all(_.values(_.mapValues(countriesMapping, (name, code) =>
        config.db.select().from('Country')
          .where({ code })
          .one()
          .then((existingCountry) => {
            if (_.isUndefined(existingCountry)) {
              return config.db.class.get('Country')
                .then((Country) => Country.create({
                  code,
                  name,
                }));
            }
            return config.db.update(existingCountry['@rid'])
              .set({
                code,
                name,
              })
              .one();
          }))));
    })
    .then((writtenCountries) => {
      console.log(`Upserted ${writtenCountries.length} countries`);
      process.exit();
    })
    .catch((err) => {
      console.error(err);
      process.exit(-1);
    });
}

importCountries();

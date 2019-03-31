/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');

const config = require('../config/default');
const helpers = require('./helpers');

function importDirective() {
  helpers.fetchRemoteFile(new URL(config.staticDataUrls.directiveTenders))
    .then((directiveTenders) => {
      console.log('Upserting CAN sources under directive...');
      return Promise.map(directiveTenders, (sourceUrl) =>
        config.db.select().from('DirectiveCAN')
          .where({ sourceUrl })
          .one()
          .then((existingCANSource) => {
            if (_.isUndefined(existingCANSource)) {
              return config.db.class.get('DirectiveCAN')
                .then((DirectiveCAN) => DirectiveCAN.create({ sourceUrl }));
            }
            return config.db.update(existingCANSource['@rid']).set({ sourceUrl }).one();
          }));
    })
    .then((writtenDirectiveTenders) => {
      console.log(`Upserted ${writtenDirectiveTenders.length} CAN sources under directive`);
      process.exit();
    })
    .catch((err) => {
      console.error(err);
      process.exit(-1);
    });
}

importDirective();

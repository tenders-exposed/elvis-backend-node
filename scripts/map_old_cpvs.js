/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { URL } = require('url');
const Promise = require('bluebird');

const config = require('../config/default');
const helpers = require('./helpers');

const correspondenceURL = new URL('https://raw.githubusercontent.com/tenders-exposed/data_sources/master/cpvs_2003_2007_correspondence.json');
const standardCpvsURL = new URL('https://raw.githubusercontent.com/tenders-exposed/data_sources/master/cpv_codes.json');

function mapOldCPVs() {
  return helpers.fetchRemoteFile(standardCpvsURL)
    .then((standardCpvsList) => {
      const standardCpvs = _.groupBy(standardCpvsList, 'code');

      return helpers.fetchRemoteFile(correspondenceURL)
        .then((correspondenceList) => {
          const withCorrespondence = _.reject(correspondenceList, (code) => _.isNull(code.code_2003));
          const groupedBy2003Cpv = _.groupBy(withCorrespondence, 'code_2003');
          const cpvList2003 = _.keys(groupedBy2003Cpv);

          return Promise.map(cpvList2003, (cpv2003) => {
            const group = groupedBy2003Cpv[cpv2003]
            // Always map to the most general 2007 CPV
            const cpv2007 = _.first(_.sortBy(group, 'code_2007'));
            const standardCpv = standardCpvs[cpv2007.code_2007][0];
            const mappedCpv = {
              code: standardCpv.code,
              xOriginalCode: cpv2003,
              xName: standardCpv.text,
              xNumberDigits: standardCpv.number_digits,
            };
            // console.log(mappedCpv);
            return config.db.select().from('CPV')
              .where({ xOriginalCode: cpv2003 })
              .one()
              .then((existingCpv) => {
                if (_.isUndefined(existingCpv)) {
                  return config.db.create('vertex', 'CPV')
                    .set(mappedCpv)
                    .commit()
                    .one();
                }
                return config.db.update('CPV')
                  .set(mappedCpv)
                  .where({ '@rid': existingCpv['@rid'] })
                  .return('AFTER')
                  .commit()
                  .one();
              })
          });
        });
    })
    .then((mappedCPVs) => {
      console.log(`Processed ${mappedCPVs.length} 2003 CPVs`);
      process.exit();
    })
    .catch((err) => {
      console.error(err);
      process.exit(-1);
    });
}

mapOldCPVs();

'use strict';

const fs = require('fs');
const _ = require('lodash');
const Promise = require('bluebird');
const readline = require('readline');
const PQueue = require('p-queue');
const pRetry = require('p-retry');
const OrientDBError = require('orientjs/lib/errors');

const writers = require('./../api/writers');

const program = require('commander');

program
  .arguments('<dumpFilePath> [moreDumpFilePaths...]')
  .description('import data from JSON dump files')
  .option('-c --concurrent_lines [no.lines]', 'Number of concurrent lines processed at once per file')
  .option('-r -retries [no.retries]', 'Number of retries for a failed line')
  .action((dumpFilePath, moreDumpFilePaths, options) => {
    const concurrency = _.toSafeInteger(options.concurrent_lines) || 1000;
    const retries = _.toSafeInteger(options.retries) || 1;
    const dumpFilePaths = _.concat([], dumpFilePath, moreDumpFilePaths);
    Promise.map(dumpFilePaths, (filePath) => importFileData(filePath, concurrency, retries))
      .then(() => process.exit())
      .catch((err) => {
        console.error(err); // eslint-disable-line no-console
        process.exit(-1);
      });
  });

program.parse(process.argv);

// TODO: Test this
function importFileData(filePath, concurrency, retries) {
  return new Promise((resolve, reject) => {
    const instream = fs.createReadStream(filePath);
    const handler = readline.createInterface({ input: instream });
    const queue = new PQueue({ concurrency });

    handler.on('line', (line) => {
      const writeTender = () => writers.writeTender(JSON.parse(line));
      queue.add(() => pRetry(writeTender, { retries })
        .catch((err) => {
          if (err instanceof OrientDBError.RequestError) {
            console.error('Max retries exceeded', err.message); // eslint-disable-line no-console
          } else {
            reject(err);
          }
        }));
    });

    handler.on('close', () => {
      queue.onIdle().then(() => {
        console.log('Done processing', filePath); // eslint-disable-line no-console
        resolve(true);
      });
    });
  });
}

module.export = {
  importFileData,
};

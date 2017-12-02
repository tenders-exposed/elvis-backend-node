'use strict';

const fs = require('fs');
const Promise = require('bluebird');
const readline = require('readline');
const PQueue = require('p-queue');
const pRetry = require('p-retry');
const OrientDBError = require('orientjs/lib/errors');


const writers = require('./../api/writers');

function importFileData(filePath) {
  return new Promise((resolve, reject) => {
    const instream = fs.createReadStream(filePath);
    const handler = readline.createInterface({ input: instream });
    const queue = new PQueue({ concurrency: 5000 });
    let cursor = 0;

    handler.on('line', (line) => {
      const writeTender = () => writers.writeTender(JSON.parse(line))
        .then(() => {
          cursor += 1;
          console.log('Launched writer no', cursor); // eslint-disable-line no-console
        });
      queue.add(() => pRetry(writeTender)
        .then(() => console.log('Written tender')) // eslint-disable-line no-console
        .catch((err) => {
          if (err instanceof OrientDBError.RequestError) {
            console.error('Max no. retries exceeded for line', line); // eslint-disable-line no-console
          } else {
            reject(err);
          }
        }));
    });

    handler.on('close', () => {
      queue.onIdle().then(() => {
        console.log('Done processing the file', filePath); // eslint-disable-line no-console
        resolve(true);
      });
    });
  });
}

function importDumpFiles() {
  const dumpFilePaths = process.argv.slice(2);
  Promise.map(dumpFilePaths, (filePath) => importFileData(filePath))
    .then(() => process.exit())
    .catch((err) => {
      console.error(err); // eslint-disable-line no-console
      process.exit(-1);
    });
}

importDumpFiles();

module.export = {
  importFileData,
};

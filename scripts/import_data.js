'use strict';

const _ = require('lodash');
const fs = require('fs');
const Promise = require('bluebird');
const readline = require('readline');

const writers = require('./../api/writers');

function importFileData(filePath) {
  return new Promise((resolve, reject) => {
    const instream = fs.createReadStream(filePath);
    const handler = readline.createInterface({ input: instream });

    handler.on('line', (line) => {
      writers.writeTender(JSON.parse(line));
    });

    handler.on('error', (err) => {
      reject(err);
    });

    handler.on('close', () => {
      console.log('Done processing the file', filePath);
      resolve(true);
    });
  });
}

function importDumpFiles() {
  const dumpFilePaths = process.argv.slice(2);
  Promise.map(dumpFilePaths, (filePath) => importFileData(filePath))
    .then(() => process.exit())
    .catch((err) => {
      console.error(err);
      process.exit(-1);
    });
}

importDumpFiles();

module.export = {
  importFileData,
};

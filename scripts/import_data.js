'use strict';

const _ = require('lodash');
const fs = require('fs');
const Promise = require('bluebird');
const readline = require('readline');
const PQueue = require('p-queue');

const writers = require('./../api/writers');
const queue = new PQueue({concurrency: 1});

function importFileData(filePath) {
  return new Promise((resolve, reject) => {
    const instream = fs.createReadStream(filePath);
    const handler = readline.createInterface({ input: instream });
    let cursor = 0;

    handler.on('line', (line) => {
      queue.add(() => writers.writeTender(JSON.parse(line)).then(() => {
        cursor += 1;
        console.log(`${cursor} writers launched`);
      }));
    });

    handler.on('error', (err) => {
      reject(err);
    });

    handler.on('close', () => {
      queue.onEmpty().then(() => {
	      console.log('Queue is empty');
        console.log('Done processing the file', filePath);
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
      console.error(err);
      process.exit(-1);
    });
}

importDumpFiles();

module.export = {
  importFileData,
};

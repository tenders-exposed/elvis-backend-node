/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const config = require('config');

function migrationsToRun() {
  const args = process.argv;
  let numberOfMigrations = NaN;
  if (args.length > 2) {
    numberOfMigrations = parseInt(args.slice(2)[0], 10);
    const msg = 'Argument should be the number of migrations to run (default all)';
    assert.deepEqual(args.slice(2).length, 1, msg);
    assert.deepEqual(Number.isInteger(numberOfMigrations), true, msg);
  }
  return numberOfMigrations;
}

config.migrationManager.up(migrationsToRun())
  .then((migrated) => {
    console.log(`Applied ${migrated.length} migrations:\n\t${migrated.join('\n\t')}`);
  })
  .then(() => process.exit())
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });

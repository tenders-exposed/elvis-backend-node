
const Promise = require('bluebird');
const assert = require('assert');
const OrientDB = require('orientjs');
const config = require('./../config');

const migrationsDir = __dirname + '/..' + '/migrations';

function migrationsToRun() {
  const args = process.argv;
  let numberOfMigrations = NaN
  if (args.length > 2) {
    numberOfMigrations = parseInt(args.slice(2)[0], 10);
    const msg = `Argument should be the number of migrations to run (default all)`;
    assert.deepEqual(args.slice(2).length, 1, msg);
    assert.deepEqual(Number.isInteger(numberOfMigrations), true, msg);
  }
  return numberOfMigrations;
}

const manager = new OrientDB.Migration.Manager({
  db: config.db,
  dir: migrationsDir,
});

manager.up(migrationsToRun())
.then((migrated) => {
  console.log(`Applied ${migrated.length} migrations:\n\t${migrated.join('\n\t')}`);
})
.then(() => process.exit())
.catch((err) => {
  console.error(err);
  process.exit(-1);
});

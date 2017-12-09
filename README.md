# elvis-backend-node

[![Coverage Status](https://coveralls.io/repos/github/tenders-exposed/elvis-backend-node/badge.svg?branch=master)](https://coveralls.io/github/tenders-exposed/elvis-backend-node?branch=master)

Search and visualize public procurements for EU countries http://elvis.tenders.exposed/

Previously, elvis.tenders.exposed was powered by tenders-exposed/elvis-backend but we decided to rewrite it completely because:

* the previous architecture based on MongoDB didn't allow us to efficiently implement clustering and splitting nodes
* the data provider changed and the data structure along with it

We chose Node.js because:

* we decided to use a graph database (OrientDB) and the Node.js ecosystem offered good tools for this
* Node.js is more widespread across the open spending and open contracting community

#### Contributing

1. Download OrientDB `2.2.30`:

    `docker run --name orientdb -p 2424:2424 -p 2480:2480 -e ORIENTDB_ROOT_PASSWORD={yourRootPass} orientdb:2.2.30
`

2. Create databases:

    `docker exec -it orientdb /orientdb/bin/console.sh`

    In the ODB console:

    `CREATE DATABASE remote:localhost/{yourDBName} root {yourRootPass} plocal graph`

    And a test db, preferably in memory:

    `CREATE DATABASE remote:localhost/{yourTestingDBName} root {yourRootPass} memory graph`

3. Clone this repo:

    `git clone https://github.com/tenders-exposed/elvis-backend-node.git`

4. Configure environment variables:

    `cd elvis-backend-node`

    In the root of the project make a new file called `.env` from the `.env.example` file:

    `cp .env.example .env`

    Edit `.env` with your settings. If you went with the ODB defaults like above, it will look like this:

    ```
    ORIENTDB_HOST=localhost
    ORIENTDB_PORT=2424
    ORIENTDB_DB={yourDBName}
    # Admin is the default ODB user
    ORIENTDB_USER=admin
    ORIENTDB_PASS=admin
    ORIENTDB_TEST_DB={yourTestingDBName}
    ```

5. Create the database schema for the dev db:

    The test db is migrated automatically before every test.

    `npm run migrate`

6. Open OrientDB Studio in a browser at `http://localhost:2480/studio/index.html` to see if the database contains the schema we migrated

7. Run the tests with:

    `npm run test`

8. Run the linter with:

    `npm run lint`


9. Install [OrientJS](https://github.com/orientechnologies/orientjs) globally to get access to their CLI. For example to create a new migration:

    `orientjs -h localhost -p 2424 -n elvis -U admin -P admin migrate create {newMigrationName}`

#### Import data
The amount of data we have is overwhelming for a single Node process. Not only
does the import take long but it reaches [Heap out of memory error](https://stackoverflow.com/questions/38558989/node-js-heap-out-of-memory) even with up to 15GB of RAM.
To speed things up and avoid overwhelming an individual process we are now running a Node process for each
file instead of passing multile files to the same process.
To achieve this we make a docker container to import each file and we orchestrate the containers with [GNU parallel](https://www.gnu.org/software/parallel/man.html#DESCRIPTION):

```
find /folder/with/data/files -iname '*.json' -printf "%f\n" | \
parallel --progress -I"{}" -j5 \
docker-compose run --name="elvis_import_"{} --rm elvis_api \
node --max-old-space-size=4096 ./scripts/import_data.js -c 1000 -r 1 /rawdata/data/exported_by_country/{}
```

With `-j5` we are telling `parallel` to process 5 containers at once. We also
use `--max-old-space-size=4096` to allow each node process up to 4GB of RAM. We also set
number of retries for import data sript with `-r` and how many concurrent lines should
be processed with `-c`.

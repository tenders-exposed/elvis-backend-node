'use strict';

const Promise = require('bluebird');

exports.name = 'add normalized name to bidder and buyer';

exports.up = (db) => (
  Promise.map(['Bidder', 'Buyer'], (className) => {
    db.class.get(className)
      .then((Class) => Class.property.create({
        name: 'normalizedName',
        type: 'String',
      }))
      .then(() => db.query(`CREATE INDEX ${className}.name 
        ON ${className}(name, normalizedName) FULLTEXT ENGINE LUCENE`));
  })
);

exports.down = (db) => (
  Promise.map(['Bidder', 'Buyer'], (className) => {
    db.index.drop(`${className}.name`)
      .then(() => db.class.get(className))
      .then((Class) => Class.property.drop('normalizedName'));
  })
);

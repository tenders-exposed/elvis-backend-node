'use strict';

const Promise = require('bluebird');

exports.name = 'rename visible to active';

exports.up = (db) => Promise.map(['NetworkVertex', 'NetworkEdge'], (className) => {
  db.class.get(className)
    .then((classObj) => classObj.property.rename('visible', 'active'));
});

exports.down = (db) => Promise.map(['NetworkVertex', 'NetworkEdge'], (className) => {
  db.class.get(className)
    .then((classObj) => classObj.property.rename('active', 'visible'));
});

'use strict';

exports.name = 'create has edge';

exports.up = (db) => db.class.create('Owns', 'E');

exports.down = (db) => db.class.drop('Owns');

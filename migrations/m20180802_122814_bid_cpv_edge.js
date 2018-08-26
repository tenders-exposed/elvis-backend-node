'use strict';

exports.name = 'create bid cpv edge';

exports.up = (db) => db.class.create('BidHasCPV', 'E');

exports.down = (db) => db.class.drop('BidHasCPV');

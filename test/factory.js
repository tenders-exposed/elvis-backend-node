'use strict';

const FactoryGirl = require('factory-girl');
const Tender = require('../api/models/tender');

const factory = FactoryGirl.factory;
factory.setAdapter(new FactoryGirl.DefaultAdapter());

factory.define('tender', Tender, {
  // use sequences to generate values sequentially
  id: factory.sequence((n) => `tender_${n}`),
  modified: '2017-06-08T11:55:43.525',
});


module.exports = factory;


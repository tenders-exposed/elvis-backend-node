'use strict';

const uuidv4 = require('uuid/v4');
const FactoryGirl = require('factory-girl');
const BaseNode = require('./base_node');

const factory = FactoryGirl.factory;
factory.setAdapter(new FactoryGirl.DefaultAdapter());

factory.define('tender', BaseNode, {
  class: 'Tender',
  id: uuidv4(),
  xDigiwhistLastModified: '2017-06-08 11:55:43',
  country: 'NL',
});

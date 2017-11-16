'use strict';

const should = require('should');
const config = require('./../config');
const helpers = require('./helpers');
const writeTender = require('./../scripts/import_data').writeTender;

describe('import data', () => {
  beforeEach(helpers.createDB);
  afterEach(helpers.dropDB);

  describe('writeTender', () => {
    it('creates a new Tender', () => {
      return true;
    });
  });
});

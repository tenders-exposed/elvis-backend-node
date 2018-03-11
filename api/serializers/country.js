'use strict';

const _ = require('lodash');

function formatCountry(country) {
  return _.pick(country, ['code', 'name']);
}

module.exports = {
  formatCountry,
};

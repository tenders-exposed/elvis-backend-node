'use strict';

const _ = require('lodash');

function formatCpv(cpvNode) {
  return _.pick(cpvNode, ['code', 'xName', 'xNumberDigits', 'xNumberBids', 'military']);
}

module.exports = {
  formatCpv,
};

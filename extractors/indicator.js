'use strict';

const _ = require('lodash');
const helpers = require('./helpers');

function extractIndicator(indicatorAttrs) {
  if (_.isUndefined(indicatorAttrs) || _.isEmpty(indicatorAttrs)) {
    return undefined;
  }
  return {
    id: indicatorAttrs.id,
    xDigiwhistLastModified: helpers.formatTimestamp(indicatorAttrs.modified),
    type: indicatorAttrs.type,
    value: indicatorAttrs.value,
  };
}

module.exports = {
  extractIndicator,
};

'use strict';

const _ = require('lodash');
const uuidv4 = require('uuid/v4');

function extractIndicator(indicatorAttrs) {
  if (_.isUndefined(indicatorAttrs) || _.isEmpty(indicatorAttrs)) {
    return undefined;
  }
  return {
    id: uuidv4(),
    type: indicatorAttrs.type,
    value: indicatorAttrs.value,
  };
}

module.exports = {
  extractIndicator,
};

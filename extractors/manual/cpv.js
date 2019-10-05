'use strict';

const _ = require('lodash');

//TODO: Make sure we don't overwrite the cpv attrs when updating these
function extractCpv(tenderAttrs) {
  return {
    xOriginalCode: extractCpvCode(tenderAttrs.CPV),
    code: extractCpvCode(tenderAttrs.CPV),
  };
}

function extractHasCpv() {
  return {
    isMain: undefined,
  };
}

function extractCpvCode(rawCode) {
  return _.split(rawCode, /\D/)[0] || undefined;
}

module.exports = {
  extractCpv,
  extractCpvCode,
  extractHasCpv,
};

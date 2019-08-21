'use strict';

const _ = require('lodash');

function extractCpv(cpvAttrs) {
  return {
    xName: cpvAttrs.name,
    xOriginalCode: extractCpvCode(cpvAttrs.code),
    xNumberDigits: cpvAttrs.xNumberDigits,
  };
}

function extractHasCpv(cpvAttrs) {
  return {
    isMain: cpvAttrs.isMain || false,
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

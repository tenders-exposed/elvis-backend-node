'use strict';

function extractCpv(cpvAttrs) {
  return {
    xName: cpvAttrs.name,
    code: cpvAttrs.code,
    xNumberDigits: cpvAttrs.xNumberDigits,
  };
}

function extractHasCpv(cpvAttrs) {
  return {
    isMain: cpvAttrs.isMain || false,
  };
}

module.exports = {
  extractCpv,
  extractHasCpv,
};

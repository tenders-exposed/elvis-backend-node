'use strict';

function extractCpv(cpvAttrs) {
  return {
    xName: cpvAttrs.name,
    code: cpvAttrs.code,
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

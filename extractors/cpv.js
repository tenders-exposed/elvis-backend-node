'use strict';

function extractCPV(cpvAttrs) {
  return {
    xName: cpvAttrs.name,
    code: cpvAttrs.code,
  };
}

function extractHasCPV(cpvAttrs) {
  return {
    isMain: cpvAttrs.isMain,
  };
}

module.exports = {
  extractCPV,
  extractHasCPV,
};

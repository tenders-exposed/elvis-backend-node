'use strict';

const test = require('ava');

const cpvExtractor = require('./../../extractors/cpv');

test('extractCpvCode ignores the number of digits section of CPV code', async (t) => {
  const code = '400000-8';
  t.is(
    cpvExtractor.extractCpvCode(code),
    '400000',
  );
});

test('extractCpvCode ignores section after space', async (t) => {
  const code = '400000 -8';
  t.is(
    cpvExtractor.extractCpvCode(code),
    '400000',
  );
});

test('extractCpvCode returns undefined if cpv code is empty', async (t) => {
  t.is(
    cpvExtractor.extractCpvCode(''),
    undefined,
  );
});

test('extractCpvCode return undefined if cpv code is undefined', async (t) => {
  t.is(
    cpvExtractor.extractCpvCode(undefined),
    undefined,
  );
});

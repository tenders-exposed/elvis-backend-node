'use strict';

const moment = require('moment');
const test = require('ava');

const extractorHelpers = require('./../../extractors/helpers');

test('formatTimestamp returns undefined for undefined strings', (t) => {
  t.is(extractorHelpers.formatTimestamp(undefined), undefined);
});

test('formatTimestamp alters only format not value', (t) => {
  const timestampAttrs = {
    years: 2013,
    months: 3,
    date: 22,
    hours: 23,
    minutes: 20,
    seconds: 12,
    milliseconds: 0,
  };
  const initial = moment().set(timestampAttrs).format('YYYY-MM-DDTHH:mm:ssZ');
  const formatted = extractorHelpers.formatTimestamp(initial);
  t.deepEqual(moment(formatted).toObject(), timestampAttrs);
});

test('removeDiacritics returns undefined for undefined strings', (t) => {
  t.is(extractorHelpers.removeDiacritics(undefined), undefined);
});

test('removeDiacritics returns string without diacritics', (t) => {
  const initial = 'Římskokatolická';
  const normalized = 'Rimskokatolicka';
  t.is(extractorHelpers.removeDiacritics(initial), normalized);
});

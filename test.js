#!/usr/bin/env node
// ============================================================
//  Unit tests — pure functions from lib.js
//  Run:  node --test test.js  |  node test.js  |  npm test
//
//  These import the SAME lib.js the browser client loads, so there
//  is no longer a duplicated copy to drift out of sync.
//
//  Server smoke + alert flow is covered by test-integration.js.
// ============================================================

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const lib = require('./lib.js');

const { escapeHtml, formatShelter, shelterClass, distanceKm, isDND, normalizeCity, fuzzyMatch } = lib;

// Hebrew labels for formatShelter (the client passes translated strings at runtime)
const HE = { imm: 'מיד', sec: 'שניות', min: 'דקות', minSingle: 'דקה' };

describe('lib exports', () => {
  test('all functions + data present', () => {
    for (const fn of ['escapeHtml', 'formatShelter', 'shelterClass', 'distanceKm', 'isDND', 'normalizeCity', 'fuzzyMatch'])
      assert.equal(typeof lib[fn], 'function', `${fn} is a function`);
    assert.equal(typeof lib.CITIES, 'object', 'CITIES present');
    assert.ok(Object.keys(lib.CITIES).length > 50, 'CITIES has entries');
    assert.equal(typeof lib.LN.he, 'object', 'LN.he present');
    assert.ok(Array.isArray(lib.SHELTERS_DEFAULT), 'SHELTERS_DEFAULT is array');
  });
});

describe('escapeHtml', () => {
  test('escapes HTML tags', () => assert.equal(escapeHtml('<script>'), '&lt;script&gt;'));
  test('escapes quotes', () => assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;'));
  test('escapes ampersand first (no double-escape)', () => assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry'));
  test('leaves normal text', () => assert.equal(escapeHtml('normal text'), 'normal text'));
  test('empty string', () => assert.equal(escapeHtml(''), ''));
  test('null → empty', () => assert.equal(escapeHtml(null), ''));
  test('undefined → empty', () => assert.equal(escapeHtml(undefined), ''));
  test('number → empty', () => assert.equal(escapeHtml(123), ''));
});

describe('formatShelter', () => {
  test('zero = immediately', () => assert.equal(formatShelter(0, HE), 'מיד'));
  test('15 seconds', () => assert.equal(formatShelter(15, HE), '15 שניות'));
  test('30 seconds', () => assert.equal(formatShelter(30, HE), '30 שניות'));
  test('60 sec = 1 minute (singular)', () => assert.equal(formatShelter(60, HE), '1 דקה'));
  test('90 sec = 1.5 minutes', () => assert.equal(formatShelter(90, HE), '1.5 דקות'));
  test('180 sec = 3 minutes', () => assert.equal(formatShelter(180, HE), '3 דקות'));
  test('default labels when none passed', () => assert.equal(formatShelter(0), 'מיד'));
});

describe('shelterClass', () => {
  test('0 = immediate', () => assert.equal(shelterClass(0), 'immediate'));
  test('15 = immediate', () => assert.equal(shelterClass(15), 'immediate'));
  test('16 = fast', () => assert.equal(shelterClass(16), 'fast'));
  test('30 = fast', () => assert.equal(shelterClass(30), 'fast'));
  test('31 = medium', () => assert.equal(shelterClass(31), 'medium'));
  test('60 = medium', () => assert.equal(shelterClass(60), 'medium'));
  test('90 = slow', () => assert.equal(shelterClass(90), 'slow'));
  test('180 = slow', () => assert.equal(shelterClass(180), 'slow'));
});

describe('distanceKm', () => {
  test('TLV → JLM ≈ 54km', () => { const d = distanceKm(32.0853, 34.7818, 31.7683, 35.2137); assert.ok(d > 50 && d < 70, `got ${d.toFixed(1)}`); });
  test('same point = 0 km', () => assert.equal(Math.round(distanceKm(32, 34, 32, 34)), 0));
  test('TLV → Haifa ≈ 81km', () => { const d = distanceKm(32.0853, 34.7818, 32.794, 34.9896); assert.ok(d > 70 && d < 90, `got ${d.toFixed(1)}`); });
});

describe('isDND', () => {
  test('23:00 enabled → true', () => assert.equal(isDND(23, true), true));
  test('00:00 enabled → true', () => assert.equal(isDND(0, true), true));
  test('03:00 enabled → true', () => assert.equal(isDND(3, true), true));
  test('06:00 enabled → true', () => assert.equal(isDND(6, true), true));
  test('07:00 enabled → false', () => assert.equal(isDND(7, true), false));
  test('12:00 enabled → false', () => assert.equal(isDND(12, true), false));
  test('22:00 enabled → false', () => assert.equal(isDND(22, true), false));
  test('23:00 disabled → false', () => assert.equal(isDND(23, false), false));
});

describe('normalizeCity', () => {
  test('strips separators', () => assert.equal(normalizeCity('תל אביב - יפו'), 'תל אביב יפו'));
  test('collapses spaces', () => assert.equal(normalizeCity('באר   שבע'), 'באר שבע'));
});

describe('fuzzyMatch', () => {
  const mockCities = { 'תל אביב': {}, 'ירושלים': {}, 'חיפה': {}, 'באר שבע': {}, 'אשקלון': {} };
  test('exact match', () => assert.equal(fuzzyMatch('תל אביב', mockCities), 'תל אביב'));
  test('substring match (with separator)', () => assert.equal(fuzzyMatch('תל אביב - יפו', mockCities), 'תל אביב'));
  test('exact Hebrew', () => assert.equal(fuzzyMatch('ירושלים', mockCities), 'ירושלים'));
  test('no match returns null', () => assert.equal(fuzzyMatch('לא קיימת', mockCities), null));
  test('resolves against real CITIES', () => assert.equal(fuzzyMatch('שדרות', lib.CITIES), 'שדרות'));
});

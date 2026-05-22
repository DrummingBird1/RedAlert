#!/usr/bin/env node
// ============================================================
//  Unit tests — pure client functions
//  Run:  node --test test.js
//        node test.js              (auto-discovers tests)
//        npm test
//
//  These re-implement the pure-logic functions from index.html
//  to test them in Node. KEEP IN SYNC with index.html when those
//  functions change (no shared lib until we modularize the client).
//
//  Server smoke + alert flow is covered by test-integration.js.
// ============================================================

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Subjects under test (mirror index.html) ──────────────────

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatShelter(s) {
  if (s === 0) return 'מיד';
  if (s < 60) return `${s} שניות`;
  const m = s / 60;
  const label = m === 1 ? 'דקה' : 'דקות';
  return `${m % 1 === 0 ? m : m.toFixed(1)} ${label}`;
}

function shelterClass(s) {
  if (s <= 15) return 'immediate';
  if (s <= 30) return 'fast';
  if (s <= 60) return 'medium';
  return 'slow';
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isDND(hour, enabled) {
  if (!enabled) return false;
  return hour >= 23 || hour < 7;
}

function normalizeCity(name) {
  return name.trim().replace(/[-–—]/g, ' ').replace(/['"״׳]/g, '').replace(/\s+/g, ' ');
}

function fuzzyMatch(input, cities) {
  const norm = normalizeCity(input);
  if (cities[norm]) return norm;
  const keys = Object.keys(cities);
  const sub = keys.find(c => norm.includes(normalizeCity(c)) || normalizeCity(c).includes(norm));
  return sub || null;
}

// ── Tests ────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes HTML tags', () => { assert.equal(escapeHtml('<script>'), '&lt;script&gt;'); });
  test('escapes quotes', () => { assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;'); });
  test('escapes ampersand first to avoid double-escaping', () => { assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry'); });
  test('leaves normal text untouched', () => { assert.equal(escapeHtml('normal text'), 'normal text'); });
  test('empty string returns empty', () => { assert.equal(escapeHtml(''), ''); });
  test('null returns empty', () => { assert.equal(escapeHtml(null), ''); });
  test('undefined returns empty', () => { assert.equal(escapeHtml(undefined), ''); });
  test('non-string returns empty', () => { assert.equal(escapeHtml(123), ''); });
});

describe('formatShelter', () => {
  test('zero = immediately', () => { assert.equal(formatShelter(0), 'מיד'); });
  test('15 seconds', () => { assert.equal(formatShelter(15), '15 שניות'); });
  test('30 seconds', () => { assert.equal(formatShelter(30), '30 שניות'); });
  test('60 sec = 1 minute (singular)', () => { assert.equal(formatShelter(60), '1 דקה'); });
  test('90 sec = 1.5 minutes', () => { assert.equal(formatShelter(90), '1.5 דקות'); });
  test('180 sec = 3 minutes', () => { assert.equal(formatShelter(180), '3 דקות'); });
});

describe('shelterClass', () => {
  test('0 = immediate', () => { assert.equal(shelterClass(0), 'immediate'); });
  test('15 = immediate', () => { assert.equal(shelterClass(15), 'immediate'); });
  test('16 = fast', () => { assert.equal(shelterClass(16), 'fast'); });
  test('30 = fast', () => { assert.equal(shelterClass(30), 'fast'); });
  test('31 = medium', () => { assert.equal(shelterClass(31), 'medium'); });
  test('60 = medium', () => { assert.equal(shelterClass(60), 'medium'); });
  test('90 = slow', () => { assert.equal(shelterClass(90), 'slow'); });
  test('180 = slow', () => { assert.equal(shelterClass(180), 'slow'); });
});

describe('distanceKm', () => {
  test('TLV → JLM ≈ 54km', () => {
    const d = distanceKm(32.0853, 34.7818, 31.7683, 35.2137);
    assert.ok(d > 50 && d < 70, `got ${d.toFixed(1)}`);
  });
  test('same point = 0 km', () => {
    assert.equal(Math.round(distanceKm(32, 34, 32, 34)), 0);
  });
  test('TLV → Haifa ≈ 81km', () => {
    const d = distanceKm(32.0853, 34.7818, 32.794, 34.9896);
    assert.ok(d > 70 && d < 90, `got ${d.toFixed(1)}`);
  });
});

describe('isDND', () => {
  test('23:00 enabled → true', () => { assert.equal(isDND(23, true), true); });
  test('00:00 enabled → true', () => { assert.equal(isDND(0, true), true); });
  test('03:00 enabled → true', () => { assert.equal(isDND(3, true), true); });
  test('06:00 enabled → true', () => { assert.equal(isDND(6, true), true); });
  test('07:00 enabled → false', () => { assert.equal(isDND(7, true), false); });
  test('12:00 enabled → false', () => { assert.equal(isDND(12, true), false); });
  test('22:00 enabled → false', () => { assert.equal(isDND(22, true), false); });
  test('23:00 disabled → false', () => { assert.equal(isDND(23, false), false); });
});

describe('fuzzyMatch', () => {
  const mockCities = { 'תל אביב': {}, 'ירושלים': {}, 'חיפה': {}, 'באר שבע': {}, 'אשקלון': {} };
  test('exact match', () => { assert.equal(fuzzyMatch('תל אביב', mockCities), 'תל אביב'); });
  test('substring match (with separator)', () => { assert.equal(fuzzyMatch('תל אביב - יפו', mockCities), 'תל אביב'); });
  test('exact Hebrew', () => { assert.equal(fuzzyMatch('ירושלים', mockCities), 'ירושלים'); });
  test('no match returns null', () => { assert.equal(fuzzyMatch('לא קיימת', mockCities), null); });
});

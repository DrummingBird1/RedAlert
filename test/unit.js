#!/usr/bin/env node
// ============================================================
//  Unit tests — pure functions from lib.js
//  Run:  node --test test/unit.js  |  node test/unit.js  |  npm test
//
//  These import the SAME lib.js the browser client loads, so there
//  is no longer a duplicated copy to drift out of sync.
//
//  Server smoke + alert flow is covered by test/integration.js.
// ============================================================

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../lib.js');

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

describe('i18n completeness', () => {
  const langs = Object.keys(lib.LN);
  const refKeys = Object.keys(lib.LN.en).sort();
  test('at least 14 languages', () => assert.ok(langs.length >= 14, `expected >=14, got ${langs.length}`));
  for (const l of langs) {
    test(`${l}: has every key en has`, () => {
      assert.deepEqual(Object.keys(lib.LN[l]).sort(), refKeys, `${l} key set differs from en`);
    });
    test(`${l}: has a LANG_META entry`, () => assert.ok(lib.LANG_META[l], `LANG_META.${l} missing`));
    test(`${l}: has a TTS_LOCALE entry`, () => assert.ok(lib.TTS_LOCALE[l], `TTS_LOCALE.${l} missing`));
  }
  test('rescue instruction is translated (not Hebrew) in every non-he language', () => {
    for (const l of Object.keys(lib.LN).filter(x => x !== 'he')) for (const k of ['goShelter', 'shelterWhere', 'imSafe', 'imSafeAria']) assert.ok(lib.LN[l][k] && !/[֐-׿]/.test(lib.LN[l][k]), l + '.' + k + ' missing or Hebrew');
  });
  test('LANG_META has no orphan entries beyond LN', () => {
    for (const l of Object.keys(lib.LANG_META)) assert.ok(lib.LN[l], `LANG_META has orphan ${l}`);
  });
  test('TTS_LOCALE has no orphan entries beyond LN', () => {
    for (const l of Object.keys(lib.TTS_LOCALE)) assert.ok(lib.LN[l], `TTS_LOCALE has orphan ${l}`);
  });
});

describe('isRTL', () => {
  test('Hebrew is RTL', () => assert.equal(lib.isRTL('he'), true));
  test('Arabic is RTL', () => assert.equal(lib.isRTL('ar'), true));
  test('English is LTR', () => assert.equal(lib.isRTL('en'), false));
  test('every language in LN matches RTL_LANGS', () => {
    for (const l of Object.keys(lib.LN)) assert.equal(lib.isRTL(l), lib.RTL_LANGS.includes(l), `isRTL(${l})`);
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

// Regression (v1.6.3): detectBrowserLang() used nl.slice(0,2), so Chrome's Filipino locale "fil-PH" became "fi"
// (Finnish) -> no match -> Hebrew, for the very community the Tagalog translation was added for.
describe('detectLang', () => {
  test('Filipino "fil-PH" maps to Tagalog "tl" (was sliced to "fi")', () => assert.equal(lib.detectLang(['fil-PH']), 'tl'));
  test('plain "fil" and "tl_PH" (underscore form) both map to "tl"', () => { assert.equal(lib.detectLang(['fil']), 'tl'); assert.equal(lib.detectLang(['tl_PH']), 'tl'); });
  test('legacy Hebrew code "iw" maps to "he"', () => assert.equal(lib.detectLang(['iw-IL']), 'he'));
  test('regional/script subtags collapse to the primary language', () => { assert.equal(lib.detectLang(['fr-CA']), 'fr'); assert.equal(lib.detectLang(['zh-Hans-CN']), 'zh'); });
  test('skips unsupported languages and takes the next supported one', () => assert.equal(lib.detectLang(['pt-BR', 'es']), 'es'));
  test('case-insensitive', () => assert.equal(lib.detectLang(['FIL']), 'tl'));
  test('nothing supported / empty / missing -> null', () => { assert.equal(lib.detectLang(['xx-YY']), null); assert.equal(lib.detectLang([]), null); assert.equal(lib.detectLang(undefined), null); assert.equal(lib.detectLang(['']), null); });
  test('every alias target is a real language', () => { for (const to of Object.values(lib.LANG_ALIASES)) assert.ok(lib.LN[to], `alias points at unknown language ${to}`); });
});

// Every language must carry the "feed is down" warning (the key-parity test above only proves the SAME keys exist
// everywhere; this proves the new safety string really got translated rather than left as the Hebrew original).
describe('upstreamDown warning', () => {
  test('present in all languages and non-trivial', () => { for (const l of Object.keys(lib.LN)) assert.ok(typeof lib.LN[l].upstreamDown === 'string' && lib.LN[l].upstreamDown.length > 30, `${l}.upstreamDown`); });
  test('non-Hebrew languages do not contain Hebrew letters', () => { for (const l of Object.keys(lib.LN)) if (l !== 'he') assert.ok(!/[\u0590-\u05FF]/.test(lib.LN[l].upstreamDown), `${l}.upstreamDown still has Hebrew`); });
});

// telegram-bot.js is require()-safe (no side effects at import), so its pure helpers are testable.
describe('telegram-bot', () => {
  const bot = require('../telegram-bot.js');
  test('escapeHtml neutralises tags, ampersands and quotes', () => assert.equal(bot.escapeHtml('a<b>&"c'), 'a&lt;b&gt;&amp;&quot;c'));
  test('a hostile city name cannot inject markup into the HTML-mode message', () => {
    const msg = bot.buildMessage('rockets', ['שדרות', 'כפר <b>&amp;'], 'http://x');
    assert.ok(msg.includes('כפר &lt;b&gt;&amp;amp;'), msg);
    assert.ok(!msg.includes('<b>&amp;'), 'raw hostile markup leaked into the message');
  });
  test('message keeps its own intentional <b> and <a> markup', () => {
    const msg = bot.buildMessage('uav', ['חיפה'], 'https://example.com/?a=1&b="2"');
    assert.ok(msg.includes('<b>צבע אדום — חדירת כלי טיס עוין</b>'));
    assert.ok(msg.includes('<a href="https://example.com/?a=1&amp;b=&quot;2&quot;">'), 'href must be attribute-escaped');
  });
  test('unknown type falls back to a generic emoji and its escaped raw name', () => assert.ok(bot.buildMessage('<x>', ['a'], 'http://x').startsWith('🚨 <b>צבע אדום — &lt;x&gt;</b>')));
  test('errMsg never returns blank, incl. the empty-message AggregateError Node gives for a refused localhost', () => {
    assert.equal(bot.errMsg(new Error('boom')), 'boom');
    const agg = Object.assign(new AggregateError([Object.assign(new Error(''), { code: 'ECONNREFUSED' })], ''), { code: 'ECONNREFUSED' });
    assert.equal(bot.errMsg(agg), 'ECONNREFUSED');
    assert.equal(bot.errMsg(null), 'null');
  });
});

// Regression (v1.6.4): v1.6.3 decided "feed down" from the failure COUNT alone. The live Vercel deploy freezes timers between
// requests, so the poll loop barely runs: after 100s of uptime it still had last_poll_ago:null but fewer than 3 recorded
// failures, and /api/health kept answering status "ok". The wall-clock grace since boot is what catches that case.
describe('upstreamOk', () => {
  const T = 1_000_000;
  const ok = over => lib.upstreamOk({ now: T, lastPoll: 0, start: T - 5000, fails: 0, ...over });
  test('answered recently -> ok', () => assert.equal(ok({ lastPoll: T - 2000 }), true));
  test('answered, then silent for more than 30s -> not ok', () => assert.equal(ok({ lastPoll: T - 31000 }), false));
  test('exactly 30s of silence is still ok (boundary)', () => assert.equal(ok({ lastPoll: T - 30000 }), true));
  test('never answered, just booted -> ok ("still starting")', () => assert.equal(ok({}), true));
  test('never answered, 2 failures -> still starting', () => assert.equal(ok({ fails: 2 }), true));
  test('never answered, 3 consecutive failures -> not ok', () => assert.equal(ok({ fails: 3 }), false));
  test('REGRESSION: never answered, 0 failures, but >30s since boot (timers frozen, e.g. Vercel) -> not ok', () => {
    assert.equal(ok({ start: T - 100000, fails: 0 }), false);
    assert.equal(ok({ start: T - 100000, fails: 1 }), false);
  });
  test('a recent success overrides how old the process is', () => assert.equal(ok({ start: T - 1e9, lastPoll: T - 1000 }), true));
});

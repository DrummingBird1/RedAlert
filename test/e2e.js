#!/usr/bin/env node
// ============================================================
//  E2E test — real Chromium (via Playwright, launched from the
//  system Chrome install: no bundled-browser download) against a
//  spawned server.js instance.
//
//  Covers UI regressions that unit/integration tests can't see —
//  each test here targets an actual bug fixed in a past release
//  (see CHANGELOG.md v1.4.0/v1.4.1), so a future refactor that
//  reintroduces one of these fails loudly instead of waiting for
//  a user bug report.
//
//  Run: node test/e2e.js  |  npm run test:e2e
//  Requires Chrome or Edge installed locally (dev-time only).
// ============================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PORT = 4800 + Math.floor(Math.random() * 200);
const ORIGIN = `http://localhost:${PORT}`;
let serverProc, browser, page, mockOref, dataDir;

// The server under test polls a MOCK OREF, not the real one: deterministic, offline, and — importantly — it stays
// "upstream ok" on CI runners (OREF geo-blocks non-Israeli IPs, which would trip the v1.6.3 "feed is down" banner
// and could overlay the elements these tests click). '' = 200 + empty body = healthy feed with no active alerts.
let mockBody = '';
const setAlerts = cities => { mockBody = cities.length ? JSON.stringify({ data: cities, title: 'ירי רקטות וטילים', cat: '1' }) : ''; };

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tzafir-e2e-')); // keep logs/snapshot/VAPID keys out of the developer's real repo dir
  mockOref = http.createServer((q, r) => { r.setHeader('Content-Type', 'application/json'); r.end(mockBody); });
  await new Promise(r => mockOref.listen(0, r));
  serverProc = spawn('node', ['server.js'], {
    cwd: ROOT,
    // RATE_LIMIT_PER_MIN: every test drives the same browser = one IP, and a full run of page loads (~10 requests each, plus
    // SSE reconnects) exceeds the default 120/min — the main document itself started returning 429, failing tests at random.
    env: { ...process.env, PORT: String(PORT), OREF_URL_OVERRIDE: `http://localhost:${mockOref.address().port}/`, DATA_DIR: dataDir, RATE_LIMIT_PER_MIN: '100000' },
    stdio: 'ignore',
  });
  // Wait for the server to actually accept connections instead of a fixed sleep.
  for (let i = 0; i < 40; i++) {
    try { await fetch(`${ORIGIN}/api/health`); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  // Pin the browser language: since v1.6.0 the app picks its UI language from navigator.languages, so an en-US CI runner
  // and a Hebrew developer machine would otherwise see different text (the v1.6.3 banner assertion failed on CI only).
  page = await browser.newPage({ locale: 'he-IL' });
});

after(async () => {
  try { await browser?.close(); } catch {}
  try { serverProc?.kill(); } catch {}
  try { mockOref?.close(); } catch {}
  await new Promise(r => setTimeout(r, 500)); // let the killed server release its log files (Windows locks them) before removing the dir
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
});

test('app boots with no console errors', async () => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  await page.waitForSelector('#map.leaflet-container', { timeout: 10000 }); // Leaflet applies this class to #map itself, not a child
  assert.deepEqual(errors, [], `console errors: ${errors.join(', ')}`);
});

// Regression: renderSB()/renderHistoryTab() used to replace #sbC's innerHTML (including the
// search input itself) on every keystroke, kicking focus out after a single character.
test('city search field keeps focus while typing (v1.4.0 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  const input = page.locator('#fQ');
  await input.click();
  await page.keyboard.type('תל אב', { delay: 30 });
  await page.waitForTimeout(150); // let the (rAF-coalesced) live re-render settle
  // Compare by id, not element identity: since v1.6.3 the list re-renders live, which REPLACES #fQ — a Locator-resolved
  // element can already be the detached old node, so `el === document.activeElement` is a false negative.
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'fQ', 'focus lost mid-typing');
  assert.equal(await input.inputValue(), 'תל אב', 'the space was eaten — multi-word cities cannot be typed'); // flt.q is trimmed; restoring it dropped the space
});

// Regression: the 1.2.0 visibility-restore fix called renderSB() unconditionally on
// visibilitychange, snapping the view back to the Alerts tab from whatever tab the user was on.
test('switching tabs then a visibilitychange stays on the same tab (v1.4.0 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  // currentTab is a script-scoped `let`, not a window property, so this checks rendered DOM state instead.
  await page.locator('.stab[onclick*="history"]').click();
  await page.waitForSelector('#hQ', { timeout: 5000 });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(200);
  const stillHistory = await page.locator('#hQ').count();
  assert.equal(stillHistory, 1, 'view reset away from History tab (search field #hQ no longer present)');
});

// Regression: .mn-i lacked an explicit width, so on mobile it shrank to content size instead of
// spanning the bottom nav bar, squeezing all 6 buttons into one corner.
test('mobile bottom nav spans full width (v1.4.1 regression)', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  const widths = await page.evaluate(() => {
    const mn = document.querySelector('.mn'), mni = document.querySelector('.mn-i');
    return { mn: mn.getBoundingClientRect().width, mni: mni.getBoundingClientRect().width };
  });
  assert.ok(widths.mni >= widths.mn - 2, `.mn-i (${widths.mni}px) should span .mn (${widths.mn}px)`);
  await page.setViewportSize({ width: 1280, height: 800 });
});

// Regression: shelter markers carried a permanent .ml text label that overlapped into an
// illegible smear once real, densely-packed shelter data (Tel Aviv) replaced the sparse samples.
test('shelter markers have no permanent text label (v1.4.1 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  await page.waitForFunction(() => typeof tglShl === 'function');
  await page.evaluate(() => tglShl());
  await page.waitForTimeout(300);
  const permanentLabels = await page.locator('.cm.sm .ml').count();
  assert.equal(permanentLabels, 0, 'shelter markers should not render a permanent .ml label');
});

// Regression: native <option> elements don't inherit a <select>'s custom colors, so dark-mode
// dropdowns showed unreadable light-on-light (or dark-on-dark) text.
test('select options have explicit dark-mode-safe colors (v1.4.1 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  const hasRule = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && /\.fs option|\.ls option/.test(rule.selectorText) && /background/.test(rule.cssText) && /color/.test(rule.cssText)) return true;
        }
      } catch {}
    }
    return false;
  });
  assert.equal(hasRule, true, 'expected an explicit "select option { background; color }" rule');
});

// Regression: only the Alerts tab had a literal text label in its markup; every other desktop
// tab (Stats/History/Updates/About) was icon-only with just a hover title/aria-label, so at a
// glance only "אזעקות" looked like it had a name. All 5 now render a visible, translated label.
test('every desktop tab shows a visible text label (v1.6.1 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' });
  const labels = await page.$$eval('.stab', tabs => tabs.map(t => t.textContent.trim()));
  assert.equal(labels.length, 5, `expected 5 tabs, found ${labels.length}`);
  for (const label of labels) assert.ok(label.length > 0, `a .stab has no visible text: "${label}"`);
});

// Regression: sDB() persists IndexedDB records with only `typeKey` (a string), never the full
// `type` object (icon/css/color) that rItem() reads from — so any History tab visit with real
// persisted history threw "Cannot read properties of undefined (reading 'icon')" and got stuck
// on the loading skeleton forever. Unlike every other test here, this needs IndexedDB to actually
// contain a record shaped exactly like sDB() writes it, so it's seeded directly before reload.
test('history tab renders IndexedDB-sourced entries without a type object (long-standing bug)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('alertmap', 1);
    req.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('alerts')) d.createObjectStore('alerts', { keyPath: 'id' }).createIndex('timestamp', 'timestamp'); };
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('alerts', 'readwrite');
      tx.objectStore('alerts').put({ id: 'e2e-seed-1', city: 'שדרות', region: 'עוטף עזה', typeKey: 'rockets', shelter: 15, timestamp: new Date().toISOString(), lat: 31.524, lng: 34.596 });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }));
  await page.reload({ waitUntil: 'load' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('.stab[onclick*="history"]').click();
  await page.waitForSelector('#hQ', { timeout: 5000 });
  await page.waitForTimeout(500);
  assert.deepEqual(errors, [], `console errors rendering seeded history: ${errors.join(', ')}`);
  const seededVisible = await page.locator('#sbC').evaluate(el => el.textContent.includes('שדרות'));
  assert.equal(seededVisible, true, 'seeded history entry did not render');
});

// Regression (v1.6.3): applyF() routed through refreshCurrentTab(), whose "don't re-render while #fQ has focus" guard
// (added for the v1.4.0 focus fix) also swallowed the user's OWN keystrokes — so the list never narrowed while typing,
// only ~seconds after leaving the field. The v1.4.0 test above passed regardless because nothing re-rendered at all;
// this one asserts the list actually filters AND focus + caret survive the re-render (typing continues mid-filter).
test('alerts search filters the list live while typing and keeps focus (v1.6.3 regression)', async () => {
  setAlerts(['שדרות', 'חיפה', 'אילת']);
  await page.goto(ORIGIN, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#sbC .ai').length >= 3, null, { timeout: 15000 });
  const before = await page.locator('#sbC .ai').count();
  const input = page.locator('#fQ');
  await input.click();
  await page.keyboard.type('חיפ', { delay: 40 });
  await page.waitForFunction(() => { const rows = [...document.querySelectorAll('#sbC .ai')]; return rows.length > 0 && rows.every(r => r.textContent.includes('חיפה')); }, null, { timeout: 5000 });
  const mid = await page.evaluate(() => { const q = document.getElementById('fQ'); return { focused: document.activeElement === q, value: q.value, caret: q.selectionStart, rows: document.querySelectorAll('#sbC .ai').length }; });
  assert.equal(mid.focused, true, 'focus lost after the live re-render');
  assert.equal(mid.value, 'חיפ');
  assert.equal(mid.caret, 3, 'caret not restored at the end after the re-render');
  assert.ok(mid.rows < before, `list did not narrow (${before} -> ${mid.rows})`);
  await page.keyboard.type('ה', { delay: 40 }); // keep typing AFTER a re-render: only works if focus + caret really survived
  assert.equal(await input.inputValue(), 'חיפה');
  setAlerts([]);
});

// Regression (v1.6.3): renderHistoryTab() awaits IndexedDB (slow with a large history). Switching to another tab while it
// was pending let the late render overwrite #sbC — the History list showed up under the About/Stats/Updates tab.
test('switching tabs while History is still loading does not paint it under the new tab (v1.6.3 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' });
  await page.evaluate(() => { const orig = window.gDB; window.gDB = async function () { await new Promise(r => setTimeout(r, 1200)); return orig.apply(this, arguments); }; }); // simulate a big IndexedDB
  await page.locator('.stab[onclick*="history"]').click();
  await page.waitForTimeout(200);
  await page.locator('.stab[onclick*="about"]').click();
  await page.waitForTimeout(1800); // the slow History render lands now
  const state = await page.evaluate(() => ({ historySearch: !!document.getElementById('hQ'), text: document.getElementById('sbC').textContent }));
  assert.equal(state.historySearch, false, 'History tab painted itself over the About tab');
  assert.ok(state.text.includes('חירום'), 'About tab content is no longer showing');
});

// Regression (v1.6.3): the History tab's search re-renders on every keystroke and restored the input from the TRIMMED
// flt.q, so a typed space vanished ("באר " -> "באר" -> "באר ש" became "בארש") — multi-word cities could never match.
test('history search keeps typed spaces so multi-word cities can be searched (v1.6.3 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' });
  await page.locator('.stab[onclick*="history"]').click();
  await page.waitForSelector('#hQ', { timeout: 5000 });
  await page.locator('#hQ').click();
  await page.keyboard.type('באר ש', { delay: 40 });
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#hQ').inputValue(), 'באר ש', 'the space was eaten by the re-render');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'hQ', 'focus lost in the history search');
});

// Regression (v1.6.3): a server that can't reach OREF (it geo-blocks non-Israeli datacenter IPs — the live Vercel deploy)
// used to show "מחובר" + "הכל שקט" forever. /api/health now reports upstream_ok:false and the client must warn loudly.
// /api/health is stubbed here so the test controls the state; the real degraded transition is covered in test/integration.js.
test('shows a warning banner when the server says its OREF feed is down (v1.6.3 regression)', async () => {
  let up = false;
  await page.route('**/api/health', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: up ? 'ok' : 'degraded', upstream_ok: up }) }));
  try {
    await page.goto(ORIGIN, { waitUntil: 'load' });
    await page.waitForSelector('#upBar.active', { timeout: 5000 });
    assert.equal(await page.locator('#upBar').isVisible(), true, 'banner is in the DOM but not visible');
    // Compare against the translation for whatever language is active (not a hard-coded Hebrew substring), so the
    // assertion holds on any machine locale.
    const shown = await page.evaluate(() => ({ text: document.getElementById('upBar').textContent, expected: AlertLib.LN[document.documentElement.lang].upstreamDown }));
    assert.equal(shown.text, shown.expected, 'banner text is not the translated upstreamDown string');
    assert.ok(shown.text.length > 30, 'banner has no explanatory text');
    up = true; // feed recovers
    await page.evaluate(() => checkUpstream());
    // waitForFunction, not waitForSelector: the default 'visible' state never matches a display:none element.
    await page.waitForFunction(() => !document.getElementById('upBar').classList.contains('active'), null, { timeout: 5000 });
  } finally {
    await page.unroute('**/api/health');
  }
});

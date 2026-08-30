#!/usr/bin/env node
// ============================================================
//  E2E test — real Chromium (via Playwright, launched from the
//  system Chrome install: no bundled-browser download) against a
//  spawned server.js instance.
//
//  Covers UI regressions that unit/integration tests can't see —
//  each test here targets an actual bug fixed in a past release
//  (see CHANGELOG.md v3.4.0/v3.4.1), so a future refactor that
//  reintroduces one of these fails loudly instead of waiting for
//  a user bug report.
//
//  Run: node test-e2e.js  |  npm run test:e2e
//  Requires Chrome or Edge installed locally (dev-time only).
// ============================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const PORT = 4800 + Math.floor(Math.random() * 200);
const ORIGIN = `http://localhost:${PORT}`;
let serverProc, browser, page;

before(async () => {
  serverProc = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  // Wait for the server to actually accept connections instead of a fixed sleep.
  for (let i = 0; i < 40; i++) {
    try { await fetch(`${ORIGIN}/api/health`); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

after(async () => {
  try { await browser?.close(); } catch {}
  try { serverProc?.kill(); } catch {}
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
test('city search field keeps focus while typing (v3.4.0 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  const input = page.locator('#fQ');
  await input.click();
  await page.keyboard.type('תל אב', { delay: 30 });
  await assert.equal(await input.evaluate(el => el === document.activeElement), true, 'focus lost mid-typing');
  await assert.equal(await input.inputValue(), 'תל אב');
});

// Regression: the 3.2.0 visibility-restore fix called renderSB() unconditionally on
// visibilitychange, snapping the view back to the Alerts tab from whatever tab the user was on.
test('switching tabs then a visibilitychange stays on the same tab (v3.4.0 regression)', async () => {
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
test('mobile bottom nav spans full width (v3.4.1 regression)', async () => {
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
test('shelter markers have no permanent text label (v3.4.1 regression)', async () => {
  await page.goto(ORIGIN, { waitUntil: 'load' }); // NOT 'networkidle' — the app opens a long-lived SSE connection that never goes idle
  await page.waitForFunction(() => typeof tglShl === 'function');
  await page.evaluate(() => tglShl());
  await page.waitForTimeout(300);
  const permanentLabels = await page.locator('.cm.sm .ml').count();
  assert.equal(permanentLabels, 0, 'shelter markers should not render a permanent .ml label');
});

// Regression: native <option> elements don't inherit a <select>'s custom colors, so dark-mode
// dropdowns showed unreadable light-on-light (or dark-on-dark) text.
test('select options have explicit dark-mode-safe colors (v3.4.1 regression)', async () => {
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

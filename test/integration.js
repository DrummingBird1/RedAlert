#!/usr/bin/env node
// ============================================================
//  Integration test — synthetic alert flow:
//    mock OREF → alertmap server → /api/alerts + SSE
//  Run: node test/integration.js
//  No external deps. Spawns its own mock + server.
// ============================================================

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
// Spawned servers write logs/, the store snapshot and VAPID keys. Point them at throwaway temp dirs (DATA_DIR) —
// otherwise every run seeds the developer's REAL .store-snapshot.json / logs with these mock שדרות/אשקלון alerts.
const TMP_DIRS = [];
const mkTmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tzafir-int-')); TMP_DIRS.push(d); return d; };

let passed = 0, failed = 0;
const log = m => console.log(m);
function assert(cond, name) {
  if (cond) { passed++; log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`); }
}

const MOCK_PORT = 4567 + Math.floor(Math.random() * 100);
const ALERT_PORT = MOCK_PORT + 100;
const ORIGIN = `http://localhost:${ALERT_PORT}`;

log('\n🧪 Integration test — synthetic alert flow\n');

// ── Step 1: Mock OREF that returns two cities ────────────────
let mockHits = 0;
const mockOref = http.createServer((req, res) => {
  mockHits++;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    data: ['שדרות', 'אשקלון'],
    title: 'ירי רקטות וטילים',
    cat: '1',
  }));
});

let child = null, child2 = null;
function cleanup(code) {
  try { if (child) child.kill(); } catch {}
  try { if (child2) child2.kill(); } catch {}
  try { mockOref.close(); } catch {}
  log('\n═══════════════════════════════════');
  log(`  ✅ Passed: ${passed}`);
  log(`  ❌ Failed: ${failed}`);
  log(`  📊 Total:  ${passed + failed}`);
  log('═══════════════════════════════════\n');
  const exitCode = code != null ? code : (failed > 0 ? 1 : 0);
  // Give the killed servers a moment to release their log files (Windows keeps them locked) before removing the temp dirs.
  setTimeout(() => { for (const d of TMP_DIRS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} } process.exit(exitCode); }, 500);
}

process.on('uncaughtException', e => { console.error('💥', e.message); cleanup(2); });

mockOref.listen(MOCK_PORT, () => {
  const orefUrl = `http://localhost:${MOCK_PORT}/`;
  log(`  📡 Mock OREF listening on ${orefUrl}`);

  // ── Step 2: Start alertmap server with override ────────────
  child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(ALERT_PORT), OREF_URL_OVERRIDE: orefUrl, DATA_DIR: mkTmp() },
    stdio: 'ignore',
  });
  child.on('error', e => { console.error('  ❌ spawn:', e.message); cleanup(2); });

  // Give server time to start + poll mock at least twice (2s interval)
  setTimeout(runChecks, 5000);
});

function runChecks() {
  assert(mockHits >= 1, `Mock OREF was polled (${mockHits} hits)`);

  // ── Step 3: GET /api/alerts ─────────────────────────────────
  http.get(`${ORIGIN}/api/alerts`, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(data);
        assert(Array.isArray(j.alerts), '/api/alerts: alerts is array');
        assert(j.alerts.length >= 2, `/api/alerts: at least 2 alerts (got ${j.alerts.length})`);
        const cities = j.alerts.map(a => a.city);
        assert(cities.includes('שדרות'), '/api/alerts: includes שדרות');
        assert(cities.includes('אשקלון'), '/api/alerts: includes אשקלון');
        const ids = j.alerts.map(a => a.id);
        assert(ids.every(id => /^[0-9a-f-]{36}$/.test(id)), '/api/alerts: ids are UUIDs');
        runSSECheck();
      } catch (e) {
        console.error(`  ❌ /api/alerts parse: ${e.message}`);
        failed++; cleanup();
      }
    });
  }).on('error', e => { console.error(`  ❌ /api/alerts fetch: ${e.message}`); failed++; cleanup(); });
}

function runSSECheck() {
  // ── Step 4: SSE — connect and expect 'init' frame with alerts ──
  // Cleared once init arrives — it used to fire unconditionally 3s later and was only harmless because cleanup() had already exited.
  const sseTimer = setTimeout(() => { failed++; console.error('  ❌ SSE: timeout waiting for init'); cleanup(); }, 3000);
  const sseReq = http.get(`${ORIGIN}/api/stream`, sseRes => {
    let buf = '';
    let initSeen = false;
    sseRes.on('data', chunk => {
      buf += chunk.toString();
      const m = buf.match(/data: (\{.*?\})\n\n/);
      if (m && !initSeen) {
        try {
          const evt = JSON.parse(m[1]);
          if (evt.type === 'init') {
            initSeen = true;
            clearTimeout(sseTimer);
            assert(Array.isArray(evt.alerts), 'SSE init: alerts is array');
            assert(evt.alerts.some(a => a.city === 'שדרות'), 'SSE init: includes שדרות');
            sseReq.destroy();
            runLibCheck();
          }
        } catch {}
      }
    });
  });
  sseReq.on('error', e => { console.error(`  ❌ SSE: ${e.message}`); failed++; cleanup(); });
}

// ── Step 4b: /lib.js must be served AND usable — the client loads it synchronously before its own script, so if it 404s the
// whole app is dead (no map, nothing). v1.6.4 shipped exactly that on Vercel; no test looked at /lib.js until now.
function runLibCheck() {
  http.get(`${ORIGIN}/lib.js`, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        assert(res.statusCode === 200, `/lib.js: HTTP 200 (got ${res.statusCode})`);
        assert(/javascript/.test(res.headers['content-type'] || ''), `/lib.js: javascript content-type (${res.headers['content-type']})`);
        const m = { exports: {} };
        new Function('module', 'exports', data)(m, m.exports); // evaluate the served bytes exactly as a script would
        assert(Object.keys(m.exports.LN || {}).length >= 14, '/lib.js: evaluates to an AlertLib with 14+ languages');
        assert(typeof m.exports.upstreamOk === 'function', '/lib.js: exposes upstreamOk()');
      } catch (e) {
        console.error(`  ❌ /lib.js: ${e.message}`); failed++;
      }
      runSmokeCheck();
    });
  }).on('error', e => { console.error(`  ❌ /lib.js fetch: ${e.message}`); failed++; cleanup(); });
}

// ── Step 4c: scripts/smoke.mjs (the post-deploy check) must itself pass against a healthy local server ──
function runSmokeCheck() {
  const p = spawn('node', ['scripts/smoke.mjs', ORIGIN], { cwd: ROOT, stdio: 'pipe' });
  let out = ''; p.stdout.on('data', c => out += c); p.stderr.on('data', c => out += c);
  p.on('close', code => {
    assert(code === 0, `scripts/smoke.mjs passes against a healthy server (exit ${code})`);
    if (code !== 0) console.error(out.split('\n').filter(l => /❌/.test(l)).join('\n'));
    runHealthCheck();
  });
}

function runHealthCheck() {
  // ── Step 5: /api/health reflects the polling ────────────────
  http.get(`${ORIGIN}/api/health`, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const h = JSON.parse(data);
        assert(h.status === 'ok', '/api/health: status=ok');
        assert(h.upstream_ok === true, '/api/health: upstream_ok=true while the feed answers');
        assert(h.alerts_stored >= 2, `/api/health: alerts_stored>=2 (got ${h.alerts_stored})`);
        assert(h.last_poll_ago != null, '/api/health: last_poll_ago is set');
        assert(h.last_poll_ago < 10, `/api/health: poll is recent (${h.last_poll_ago}s ago)`);
      } catch (e) {
        console.error(`  ❌ /api/health parse: ${e.message}`); failed++;
        return cleanup();
      }
      runDegradedCheck();
    });
  }).on('error', e => { console.error(`  ❌ /api/health fetch: ${e.message}`); failed++; cleanup(); });
}

// ── Step 6: a feed that never answers must surface as degraded ─────────────────────────────
// Regression (v1.6.3): the live Vercel deploy can't reach OREF (Akamai geo-block). /api/health used to hard-code
// status:'ok', so the app showed "connected / all clear" forever without ever delivering a single alert.
function runDegradedCheck() {
  const DEAD_PORT = MOCK_PORT + 200; // nothing listens here -> every poll fails with ECONNREFUSED
  const DEAD_ORIGIN = `http://localhost:${ALERT_PORT + 1}`;
  child2 = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(ALERT_PORT + 1), OREF_URL_OVERRIDE: `http://localhost:${DEAD_PORT}/`, DATA_DIR: mkTmp() },
    stdio: 'ignore',
  });
  child2.on('error', e => { console.error('  ❌ spawn (dead-feed server):', e.message); failed++; cleanup(); });
  const started = Date.now();
  const tick = () => {
    http.get(`${DEAD_ORIGIN}/api/health`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let h = null; try { h = JSON.parse(data); } catch {}
        if (h && h.status === 'degraded') {
          assert(res.statusCode === 200, 'dead feed: /api/health still answers HTTP 200 (Docker/Fly healthchecks keep working)');
          assert(h.upstream_ok === false, 'dead feed: upstream_ok=false');
          assert(h.last_poll_ago === null, 'dead feed: last_poll_ago=null (never had a successful poll)');
          return cleanup();
        }
        if (Date.now() - started > 25000) { assert(false, `dead feed: status never became degraded (last: ${data.slice(0, 120)})`); return cleanup(); }
        setTimeout(tick, 1000);
      });
    }).on('error', () => { if (Date.now() - started > 25000) { assert(false, 'dead feed: server never came up'); return cleanup(); } setTimeout(tick, 500); });
  };
  setTimeout(tick, 1500);
}

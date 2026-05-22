#!/usr/bin/env node
// ============================================================
//  Integration test — synthetic alert flow:
//    mock OREF → alertmap server → /api/alerts + SSE
//  Run: node test-integration.js
//  No external deps. Spawns its own mock + server.
// ============================================================

const http = require('http');
const { spawn } = require('child_process');

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

let child = null;
function cleanup(code) {
  try { if (child) child.kill(); } catch {}
  try { mockOref.close(); } catch {}
  log('\n═══════════════════════════════════');
  log(`  ✅ Passed: ${passed}`);
  log(`  ❌ Failed: ${failed}`);
  log(`  📊 Total:  ${passed + failed}`);
  log('═══════════════════════════════════\n');
  process.exit(code != null ? code : (failed > 0 ? 1 : 0));
}

process.on('uncaughtException', e => { console.error('💥', e.message); cleanup(2); });

mockOref.listen(MOCK_PORT, () => {
  const orefUrl = `http://localhost:${MOCK_PORT}/`;
  log(`  📡 Mock OREF listening on ${orefUrl}`);

  // ── Step 2: Start alertmap server with override ────────────
  child = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(ALERT_PORT), OREF_URL_OVERRIDE: orefUrl },
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
            assert(Array.isArray(evt.alerts), 'SSE init: alerts is array');
            assert(evt.alerts.some(a => a.city === 'שדרות'), 'SSE init: includes שדרות');
            sseReq.destroy();
            runHealthCheck();
          }
        } catch {}
      }
    });
  });
  sseReq.on('error', e => { console.error(`  ❌ SSE: ${e.message}`); failed++; cleanup(); });
  setTimeout(() => { if (failed === 0) { failed++; console.error('  ❌ SSE: timeout waiting for init'); cleanup(); } }, 3000);
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
        assert(h.alerts_stored >= 2, `/api/health: alerts_stored>=2 (got ${h.alerts_stored})`);
        assert(h.last_poll_ago != null, '/api/health: last_poll_ago is set');
        assert(h.last_poll_ago < 10, `/api/health: poll is recent (${h.last_poll_ago}s ago)`);
      } catch (e) {
        console.error(`  ❌ /api/health parse: ${e.message}`); failed++;
      }
      cleanup();
    });
  }).on('error', e => { console.error(`  ❌ /api/health fetch: ${e.message}`); failed++; cleanup(); });
}

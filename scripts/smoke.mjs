#!/usr/bin/env node
// Post-deploy smoke test — run it against a DEPLOYED URL before tagging a release:
//
//   node scripts/smoke.mjs https://red-alert-ten.vercel.app [--expect-version 1.6.5] [--header "x-vercel-protection-bypass: <secret>"]
//
// Why this exists: green unit/integration/E2E suites only prove the code works on a developer machine / CI runner. v1.6.4 passed
// all of them and still shipped a dead site — on Vercel `GET /lib.js` returned 404 (a bundler quirk), the client loads lib.js
// synchronously before its own script, so there was no map and no UI at all. This checks what a browser actually needs from the
// deployed origin, including that lib.js not only arrives but EVALUATES to a usable AlertLib.
//
// Exit code 0 = every hard check passed. A degraded /api/health is a WARNING, not a failure: it is the correct, honest answer on
// any host that cannot reach OREF (non-Israeli IP), and the app shows its warning bar there.

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:\/\//.test(a)) || '').replace(/\/+$/, '');
if (!base) { console.error('usage: node scripts/smoke.mjs <https://deployed-origin> [--expect-version X.Y.Z] [--header "k: v"]'); process.exit(2); }
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const expectVersion = opt('--expect-version');
const headers = { 'user-agent': 'tzafir-smoke/1' };
args.forEach((a, i) => { if (a === '--header' && args[i + 1]) { const [k, ...v] = args[i + 1].split(':'); headers[k.trim().toLowerCase()] = v.join(':').trim(); } });

let failed = 0, warned = 0;
const ok = (name, detail = '') => console.log(`  ✅ ${name}${detail ? '  — ' + detail : ''}`);
const bad = (name, detail = '') => { failed++; console.log(`  ❌ ${name}${detail ? '  — ' + detail : ''}`); };
const warn = (name, detail = '') => { warned++; console.log(`  ⚠️  ${name}${detail ? '  — ' + detail : ''}`); };

async function get(path) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  try { const r = await fetch(base + path, { headers, signal: ctl.signal, redirect: 'manual' }); return { r, text: await r.text() }; }
  catch (e) { return { err: e.cause?.code || e.message }; }
  finally { clearTimeout(t); }
}

console.log(`\n🔎 Smoke test — ${base}\n`);

// 1. The page itself
let deployedVersion = null;
{
  const { r, text, err } = await get('/');
  if (err) bad('GET /', err);
  else if (r.status !== 200) bad('GET /', `HTTP ${r.status}`);
  else {
    ok('GET /', `HTTP 200, ${text.length} bytes`);
    deployedVersion = (text.match(/APP_VERSION='([^']+)'/) || [])[1] || null;
    deployedVersion ? ok('page declares its version', deployedVersion) : bad('page declares its version', 'APP_VERSION not found in the HTML');
    if (expectVersion) deployedVersion === expectVersion ? ok('deployed version matches', expectVersion) : bad('deployed version matches', `expected ${expectVersion}, got ${deployedVersion} (deploy not finished, or an old deployment is still aliased)`);
    for (const id of ['id="map"', 'id="sbC"', 'id="upBar"']) text.includes(id) ? ok(`markup has ${id}`) : bad(`markup has ${id}`);
  }
}

// 2. lib.js — loaded synchronously BEFORE the app script. If it is missing or broken, nothing renders.
{
  const { r, text, err } = await get('/lib.js');
  if (err) bad('GET /lib.js', err);
  else if (r.status !== 200) bad('GET /lib.js', `HTTP ${r.status} — the client cannot start without it (no map, no UI)`);
  else {
    ok('GET /lib.js', `HTTP 200, ${text.length} bytes`);
    try {
      const m = { exports: {} }; new Function('module', 'exports', text)(m, m.exports);
      const L = m.exports;
      Object.keys(L.LN || {}).length >= 14 ? ok('lib.js evaluates to AlertLib', `${Object.keys(L.LN).length} languages`) : bad('lib.js evaluates to AlertLib', 'LN has too few languages');
      ['detectLang', 'upstreamOk', 'escapeHtml', 'isRTL'].forEach(f => typeof L[f] === 'function' ? null : bad(`AlertLib.${f}`, 'missing'));
    } catch (e) { bad('lib.js evaluates', e.message); }
  }
}

// 3. The rest of what the browser needs
for (const [path, kind] of [['/sw.js', 'js'], ['/manifest.json', 'json'], ['/api/config', 'json'], ['/api/spec', 'text']]) {
  const { r, text, err } = await get(path);
  if (err) { bad(`GET ${path}`, err); continue; }
  if (r.status !== 200) { bad(`GET ${path}`, `HTTP ${r.status}`); continue; }
  if (kind === 'json') { try { JSON.parse(text); ok(`GET ${path}`, 'valid JSON'); } catch { bad(`GET ${path}`, 'not JSON'); } }
  else ok(`GET ${path}`, `HTTP 200, ${text.length} bytes`);
}

// 4. Health — the honest signal of whether this host can actually receive alerts
{
  const { r, text, err } = await get('/api/health');
  if (err) bad('GET /api/health', err);
  else if (r.status !== 200) bad('GET /api/health', `HTTP ${r.status}`);
  else {
    let h = null; try { h = JSON.parse(text); } catch {}
    if (!h || typeof h.upstream_ok !== 'boolean') bad('GET /api/health', 'unexpected shape (no upstream_ok)');
    else if (h.upstream_ok && h.status === 'ok') ok('GET /api/health', `ok — alerts feed flowing (last poll ${h.last_poll_ago}s ago)`);
    else warn('GET /api/health', `status=${h.status} upstream_ok=${h.upstream_ok} last_poll_ago=${h.last_poll_ago} — this host is NOT receiving alerts (expected on a non-Israeli IP; the app shows a warning bar)`);
  }
}

console.log(`\n${failed ? '❌ FAILED' : '✅ PASSED'} — ${failed} failure(s), ${warned} warning(s)\n`);
process.exit(failed ? 1 : 0);

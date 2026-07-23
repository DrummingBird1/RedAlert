// ============================================================
//  שרת Proxy לאזעקות פיקוד העורף — v3
//  node server.js
//  אופציונלי: npm install web-push
//  אדמין: /admin  |  ENV: ADMIN_PASS, FALLBACK_ALERT_URL, HEALTH_WEBHOOK, DISCORD_WEBHOOK_URL
// ============================================================
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'alerts.log');
const SERVER_START = Date.now();
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
// Security: never ship a hardcoded default password. If ADMIN_PASS is unset,
// generate a strong random one at boot and print it once (see startup banner).
let ADMIN_PASS = process.env.ADMIN_PASS;
const ADMIN_PASS_GENERATED = !ADMIN_PASS;
if (ADMIN_PASS_GENERATED) ADMIN_PASS = crypto.randomBytes(12).toString('base64url');
const HEALTH_WEBHOOK = process.env.HEALTH_WEBHOOK || ''; // URL to POST when health degrades
const SHELTERS_URL = process.env.SHELTERS_URL || ''; // Optional external shelters JSON (e.g. data.gov.il export)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || ''; // Discord channel webhook (Channel Settings → Integrations → Webhooks) — posts an embed per new real alert batch

let webpush = null;
try { webpush = require('web-push'); } catch {}

// ── Logging ──────────────────────────────────────────────────
try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
const MAX_LOG_SIZE = 10 * 1024 * 1024, MAX_LOG_FILES = 5;
let logStream = null;
function openLog() { try { if (logStream) try { logStream.end(); } catch {} logStream = fs.createWriteStream(LOG_FILE, { flags: 'a', encoding: 'utf8' }); logStream.on('error', () => {}); } catch {} }
function rotateLog() { try { if (!fs.existsSync(LOG_FILE) || fs.statSync(LOG_FILE).size < MAX_LOG_SIZE) return; for (let i = MAX_LOG_FILES - 1; i >= 1; i--) { const s = i === 1 ? LOG_FILE : path.join(LOG_DIR, `alerts.${i-1}.log`), d = path.join(LOG_DIR, `alerts.${i}.log`); if (fs.existsSync(s)) try { fs.renameSync(s, d); } catch {} } openLog(); } catch {} }
function logBatch(entries) { if (!logStream || !entries.length) return; try { logStream.write(`\n=== ${new Date().toISOString()} | ${entries[0].type} | ${entries.length} | ${entries.map(e=>e.city).join(', ')} ===\n`); entries.forEach(e => logStream.write(JSON.stringify({ t: e.timestamp, id: e.id, city: e.city, type: e.type }) + '\n')); } catch {} rotateLog(); }
openLog();

// ── Rate limiting ────────────────────────────────────────────
const rateMap = new Map();
function rateOK(ip) { const now = Date.now(); let e = rateMap.get(ip); if (!e || now - e.t > 60000) { e = { t: now, c: 0 }; rateMap.set(ip, e); } return ++e.c <= 120; }
setInterval(() => { const c = Date.now() - 60000; rateMap.forEach((v, k) => { if (v.t < c) rateMap.delete(k); }); }, 300000);

// ── Security headers ─────────────────────────────────────────
function secHeaders(res, html, allowFrame) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!allowFrame) res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP frame-ancestors *: required for /embed.js use cases; X-Frame-Options is the old-school equivalent
  // img-src also allows Esri World Imagery (free, no API key) — the satellite basemap layer
  if (html) res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://server.arcgisonline.com; connect-src 'self'; frame-ancestors ${allowFrame ? '*' : "'self'"}`);
}

// ── Metrics ──────────────────────────────────────────────────
const M = { reqs: 0, alerts: 0, orefPolls: 0, orefErrs: 0, fbSwitches: 0, latMs: 0, pushSent: 0, pushErrs: 0, routes: {}, codes: {} };
const MAX_ROUTE_KEYS = 200; // bound metrics object to prevent unbounded growth from URL scanners
function track(r, c) {
  M.reqs++;
  if (M.routes[r] !== undefined) M.routes[r]++;
  else if (Object.keys(M.routes).length < MAX_ROUTE_KEYS) M.routes[r] = 1;
  else M.routes['_other'] = (M.routes['_other'] || 0) + 1;
  M.codes[c] = (M.codes[c] || 0) + 1;
}

// ── VAPID keys (only generated if web-push is available) ─────
const VAPID_F = path.join(__dirname, '.vapid-keys.json');
let vapidKeys = null;
function loadVapid() { try { if (fs.existsSync(VAPID_F)) return JSON.parse(fs.readFileSync(VAPID_F, 'utf8')); } catch {} const ec = crypto.createECDH('prime256v1'); ec.generateKeys(); const k = { publicKey: ec.getPublicKey('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), privateKey: ec.getPrivateKey('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }; try { fs.writeFileSync(VAPID_F, JSON.stringify(k, null, 2)); } catch {} return k; }
if (webpush) {
  vapidKeys = loadVapid();
  try { webpush.setVapidDetails('mailto:admin@alertmap.local', vapidKeys.publicKey, vapidKeys.privateKey); } catch { webpush = null; vapidKeys = null; }
}

// ── Push subscriptions (Map for O(1) dedupe) ─────────────────
const SUBS_F = path.join(__dirname, '.push-subs.json');
const pushSubs = new Map(); // endpoint -> { sub, favs:[] }
function loadSubs() { try { if (fs.existsSync(SUBS_F)) { const arr = JSON.parse(fs.readFileSync(SUBS_F, 'utf8')); arr.forEach(e => { if (e?.sub?.endpoint) pushSubs.set(e.sub.endpoint, { sub: e.sub, favs: Array.isArray(e.favs) ? e.favs : [], dnd: !!e.dnd }); else if (e?.endpoint) pushSubs.set(e.endpoint, { sub: e, favs: [], dnd: false }); }); } } catch {} }
// Debounced async save to avoid blocking event loop and to coalesce rapid subscribe/unsubscribe bursts
let subsSaveTimer = null;
function saveSubs() {
  if (subsSaveTimer) return;
  subsSaveTimer = setTimeout(() => {
    subsSaveTimer = null;
    fs.writeFile(SUBS_F, JSON.stringify([...pushSubs.values()]), () => {});
  }, 250);
}
loadSubs();
function isQuietHour() { const h = new Date().getHours(); return h >= 23 || h < 7; }
async function pushAll(payload, cities) {
  if (!webpush || !pushSubs.size) return;
  const quiet = isQuietHour();
  const targets = [];
  for (const [endpoint, entry] of pushSubs) {
    if (entry.favs.length && cities && cities.length && !cities.some(c => entry.favs.includes(c))) continue;
    // Per-subscriber DND: send a silent notification (no sound/vibrate) during quiet hours.
    const sub = entry.sub;
    const body = JSON.stringify({ ...payload, silent: (entry.dnd && quiet) || undefined });
    targets.push([endpoint, sub, body]);
  }
  const results = await Promise.allSettled(targets.map(([, sub, body]) => webpush.sendNotification(sub, body)));
  const bad = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') M.pushSent++;
    else { M.pushErrs++; const code = r.reason?.statusCode; if (code === 410 || code === 404) bad.push(targets[i][0]); }
  });
  if (bad.length) { bad.forEach(e => pushSubs.delete(e)); saveSubs(); }
}

// ── Body parser ──────────────────────────────────────────────
function parseBody(req) { return new Promise((res, rej) => { const ch = []; let sz = 0; req.on('data', c => { sz += c.length; if (sz > 1e6) { req.destroy(); rej(new Error('Too large')); } ch.push(c); }); req.on('end', () => { try { res(JSON.parse(Buffer.concat(ch).toString())); } catch (e) { rej(e); } }); req.on('error', rej); }); }

// ── Oref + Fallback ─────────────────────────────────────────
// OREF_URL_OVERRIDE allows pointing at a mock server (used by test-integration.js)
const OREF_URL = process.env.OREF_URL_OVERRIDE || 'https://www.oref.org.il/WarningMessages/alert/alerts.json';
const OREF_HIST = process.env.OREF_HIST_OVERRIDE || 'https://www.oref.org.il/WarningMessages/alert/History/AlertsHistory.json';
// Accept either FALLBACK_ALERT_URLS (comma-separated chain) or legacy FALLBACK_ALERT_URL
const FB_URLS = (process.env.FALLBACK_ALERT_URLS || process.env.FALLBACK_ALERT_URL || '').split(',').map(s => s.trim()).filter(Boolean);
const FB_URL = FB_URLS[0] || ''; // backward-compat for logs/health
let fbIdx = 0; // current fallback index — cycles on failure
const OREF_H = { 'Accept': 'application/json', 'Accept-Language': 'he', 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://www.oref.org.il/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
let store = [], lastHash = '', lastPoll = 0, orefFails = 0, useFB = false;
const MAX_STORE = 5000, sseClients = new Set();
// Separate Map of currently-active alerts so /api/alerts and SSE don't filter store on every read
const activeAlerts = new Map(); // id -> alert
const POLL_BASE_MS = 2000, POLL_MAX_MS = 30000;
let nextPollDelay = POLL_BASE_MS, pollTimer = null;
let orefFormatMisses = 0, formatAlerted = false; // detect OREF JSON shape changes

// ── Store snapshot (survive process restart) ─────────────────
// Persists alert history to disk so a Fly VM restart / redeploy doesn't lose it.
// Active alerts are NOT restored as active (they're ephemeral, 90s, and re-arrive from OREF).
const SNAP_F = path.join(__dirname, '.store-snapshot.json');
const SNAP_MAX = 2000; // cap persisted entries to keep the file small
let snapTimer = null;
function loadSnapshot() {
  try {
    if (!fs.existsSync(SNAP_F)) return;
    const arr = JSON.parse(fs.readFileSync(SNAP_F, 'utf8'));
    if (!Array.isArray(arr)) return;
    store = arr.slice(0, MAX_STORE).map(e => ({ ...e, active: false }));
    console.log(`♻️  Restored ${store.length} alerts from snapshot`);
  } catch {}
}
function saveSnapshot() {
  if (snapTimer) return;
  snapTimer = setTimeout(() => { snapTimer = null; fs.writeFile(SNAP_F, JSON.stringify(store.slice(0, SNAP_MAX)), () => {}); }, 2000);
}
function noteFormatMiss() {
  orefFormatMisses++;
  if (orefFormatMisses >= 20 && !formatAlerted) {
    formatAlerted = true;
    console.warn('⚠️ OREF response shape unrecognized 20× — possible format change');
    sendHealthWebhook('degraded', ['OREF response format may have changed (unrecognized JSON shape)']);
  }
}
loadSnapshot();

function fetchUrl(url, headers) { return new Promise((resolve, reject) => { const t0 = Date.now(); const mod = url.startsWith('https:') ? https : http; const req = mod.get(url, { headers: headers || OREF_H }, r => { const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => { M.latMs = Date.now() - t0; let b = Buffer.concat(ch).toString('utf8'); if (b.charCodeAt(0) === 0xFEFF) b = b.slice(1); resolve({ status: r.statusCode, body: b }); }); }); req.on('error', reject); req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); }); }); }

async function pollAlerts() {
  M.orefPolls++;
  try {
    const useFallback = useFB && FB_URLS.length > 0;
    const targetUrl = useFallback ? FB_URLS[fbIdx % FB_URLS.length] : OREF_URL;
    // Send OREF-specific headers only to OREF; use minimal generic headers for fallback URLs
    const headers = useFallback ? { 'Accept': 'application/json', 'User-Agent': 'alertmap/3.0' } : OREF_H;
    const { status, body } = await fetchUrl(targetUrl, headers);
    if (status !== 200) { orefFail(); return; }
    const markHealthy = () => { lastPoll = Date.now(); orefFails = 0; nextPollDelay = POLL_BASE_MS; if (useFB) { useFB = false; console.log('✅ OREF back'); } };
    // 200 + empty/whitespace body = OREF healthy but no active alerts (NOT a failure)
    if (!body || body.trim().length < 3) { markHealthy(); return; }
    let parsed; try { parsed = JSON.parse(body); } catch { noteFormatMiss(); orefFail(); return; }
    let areas = [], type = 'rockets', title = '', recognized = false;
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.data)) { recognized = true; areas = parsed.data; title = parsed.title || ''; const c = String(parsed.cat); if (c === '2') type = 'uav'; else if (c === '3') type = 'earthquake'; else if (c === '6') type = 'tsunami'; }
      else if (Array.isArray(parsed)) { recognized = true; areas = parsed.filter(a => typeof a === 'string'); }
    }
    if (!recognized) { noteFormatMiss(); orefFail(); return; } // 200 + parseable but unknown shape
    orefFormatMisses = 0; formatAlerted = false;
    markHealthy();
    if (!areas.length) return;
    const hash = JSON.stringify([...areas].sort());
    if (hash === lastHash) return;
    lastHash = hash; setTimeout(() => { lastHash = ''; }, 30000);
    const now = new Date().toISOString(), newIds = [], newEntries = [];
    const cleanTitle = typeof title === 'string' ? title.replace(/[<>]/g, '').slice(0, 200) : '';
    areas.forEach(city => { const safeCity = String(city).trim().slice(0, 100); const e = { id: crypto.randomUUID(), city: safeCity, type, title: cleanTitle, timestamp: now, active: true }; store.unshift(e); activeAlerts.set(e.id, e); newIds.push(e.id); newEntries.push(e); M.alerts++; });
    logBatch(newEntries);
    saveSnapshot();
    setTimeout(() => { newIds.forEach(id => { const e = store.find(a => a.id === id); if (e) e.active = false; activeAlerts.delete(id); }); }, 90000);
    if (store.length > MAX_STORE) store = store.slice(0, MAX_STORE);
    console.log(`\x1b[31m🚨 ${cleanTitle || type} — ${areas.join(', ')}\x1b[0m`);
    if (webpush && pushSubs.size) pushAll({ title: `🚨 צבע אדום — ${areas.slice(0, 3).join(', ')}${areas.length > 3 ? ' +' + (areas.length - 3) : ''}`, body: cleanTitle || type, icon: '/icon.svg', tag: `alert-${Date.now()}` }, areas).catch(() => {});
    sendDiscord(cleanTitle, type, areas);
  } catch { orefFail(); }
}
function orefFail() {
  orefFails++; M.orefErrs++;
  if (orefFails >= 5 && FB_URLS.length > 0 && !useFB) { useFB = true; M.fbSwitches++; console.warn(`⚠️ Switching to fallback [${fbIdx}]: ${FB_URLS[fbIdx]}`); }
  else if (useFB && FB_URLS.length > 1 && orefFails % 5 === 0) {
    // After 5 failures on the current fallback, rotate to the next one
    fbIdx = (fbIdx + 1) % FB_URLS.length;
    console.warn(`⚠️ Rotating to next fallback [${fbIdx}]: ${FB_URLS[fbIdx]}`);
  }
  // Exponential backoff: double the delay on each failure (capped)
  if (orefFails >= 3) nextPollDelay = Math.min(nextPollDelay * 2, POLL_MAX_MS);
}
function schedulePoll() { pollTimer = setTimeout(async () => { await pollAlerts(); schedulePoll(); }, nextPollDelay); }
setInterval(() => { if (!useFB) return; fetchUrl(OREF_URL).then(({ status }) => { if (status === 200) { useFB = false; orefFails = 0; fbIdx = 0; nextPollDelay = POLL_BASE_MS; } }).catch(() => {}); }, 60000);

// ── Health self-monitoring + webhook ─────────────────────────
let lastHealthOK = true;
function checkHealth() {
  const mem = process.memoryUsage();
  const memMB = Math.round(mem.rss / 1024 / 1024);
  const pollAgo = lastPoll ? Math.floor((Date.now() - lastPoll) / 1000) : 9999;
  const issues = [];
  if (memMB > 500) issues.push(`Memory high: ${memMB}MB`);
  if (pollAgo > 30 && M.orefPolls > 5) issues.push(`No successful poll for ${pollAgo}s`);
  if (useFB) issues.push('Using fallback source');
  if (orefFails >= 10) issues.push(`OREF failed ${orefFails} times`);

  if (issues.length > 0 && lastHealthOK) {
    lastHealthOK = false;
    sendHealthWebhook('degraded', issues);
  } else if (issues.length === 0 && !lastHealthOK) {
    lastHealthOK = true;
    sendHealthWebhook('recovered', ['All systems normal']);
  }
}
function sendHealthWebhook(status, issues) {
  if (!HEALTH_WEBHOOK) return;
  const payload = JSON.stringify({
    service: 'alertmap', status, issues, timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - SERVER_START) / 1000),
    sse_clients: sseClients.size, alerts_stored: store.length,
  });
  let url; try { url = new URL(HEALTH_WEBHOOK); } catch { return; }
  const mod = url.protocol === 'https:' ? https : http;
  const tryOnce = (attempt) => new Promise(resolve => {
    const req = mod.request(url, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, r => { r.resume(); resolve(r.statusCode >= 200 && r.statusCode < 300); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(payload); req.end();
  });
  (async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await tryOnce(i);
      if (ok) { console.log(`📡 Health webhook: ${status} — ${issues.join(', ')}${i ? ` (attempt ${i+1})` : ''}`); return; }
      if (i < 2) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // 1s, 2s
    }
    console.warn(`⚠️ Health webhook failed after 3 attempts: ${status}`);
  })();
}
setInterval(checkHealth, 30000);

// ── Discord webhook — posts an embed per new real-alert batch (zero deps: plain HTTPS POST) ──
function sendDiscord(cleanTitle, type, areas) {
  if (!DISCORD_WEBHOOK_URL || !areas.length) return;
  const payload = JSON.stringify({ embeds: [{ title: `🚨 ${cleanTitle || 'צבע אדום'}`, description: areas.slice(0, 20).join(', ') + (areas.length > 20 ? ` +${areas.length - 20}` : ''), color: 15158332, timestamp: new Date().toISOString(), footer: { text: `Tzafir · ${type}` } }] });
  let url; try { url = new URL(DISCORD_WEBHOOK_URL); } catch { return; }
  const mod = url.protocol === 'https:' ? https : http;
  const req = mod.request(url, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, r => r.resume());
  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
  req.write(payload); req.end();
}

// ── Gzip ─────────────────────────────────────────────────────
function gz(req, res, data, ct, sc = 200) { const ae = req.headers['accept-encoding'] || ''; if (/^(text\/|application\/(json|javascript|manifest))/i.test(ct) && ae.includes('gzip') && data.length > 1024) { zlib.gzip(typeof data === 'string' ? Buffer.from(data) : data, (err, z) => { if (err) { res.writeHead(sc, { 'Content-Type': ct }); res.end(data); return; } res.writeHead(sc, { 'Content-Type': ct, 'Content-Encoding': 'gzip' }); res.end(z); }); } else { res.writeHead(sc, { 'Content-Type': ct }); res.end(data); } }

// ── HTML cache ──────────────────────────────────────────────
let htmlCache = null, htmlMt = 0;
function getHtml() { const p = path.join(__dirname, 'index.html'); try { const s = fs.statSync(p); if (!htmlCache || s.mtimeMs !== htmlMt) { htmlCache = fs.readFileSync(p, 'utf8'); htmlMt = s.mtimeMs; } return htmlCache; } catch { return null; } }

// ── lib.js cache (shared data + pure functions; also required by test.js) ──
let libCache = null, libMt = 0;
function getLib() { const p = path.join(__dirname, 'lib.js'); try { const s = fs.statSync(p); if (!libCache || s.mtimeMs !== libMt) { libCache = fs.readFileSync(p, 'utf8'); libMt = s.mtimeMs; } return libCache; } catch { return null; } }

// ── PWA ─────────────────────────────────────────────────────
const MANIFEST = JSON.stringify({ name: 'צפיר', short_name: 'צפיר', description: 'ניטור התרעות פיקוד העורף בזמן אמת', start_url: '/', display: 'standalone', background_color: '#0a0e17', theme_color: '#ef4444', orientation: 'any', lang: 'he', dir: 'rtl', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] }, null, 2);
// NOTE: bump CN whenever the client (index.html) or SW logic changes, otherwise users keep cached version
const SW = `
const CN='red-alert-v11';
const TILE='red-alert-tiles-v1';
const AS=['/','/index.html','/lib.js','/manifest.json','/icon.svg'];
const CDN=['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css','https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css','https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CN);await Promise.allSettled(AS.map(u=>c.add(u)));Promise.allSettled(CDN.map(u=>c.add(new Request(u,{mode:'no-cors'}))))})());self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CN&&k!==TILE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.pathname.startsWith('/api/'))return;
  // Map basemap tiles (incl. satellite) → cache-first so previously-viewed areas work offline (capped ~500 tiles)
  if(u.hostname.endsWith('basemaps.cartocdn.com')||u.hostname==='server.arcgisonline.com'){
    e.respondWith((async()=>{
      const c=await caches.open(TILE);
      const hit=await c.match(e.request);
      if(hit)return hit;
      try{const r=await fetch(e.request);c.put(e.request,r.clone());c.keys().then(ks=>{if(ks.length>500)c.delete(ks[0])});return r;}
      catch(err){return hit||Response.error();}
    })());
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CN).then(ca=>ca.put(e.request,c)).catch(()=>{});}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));
});
self.addEventListener('push',e=>{if(!e.data)return;try{const d=e.data.json();e.waitUntil(self.registration.showNotification(d.title||'🚨',{body:d.body||'',icon:d.icon||'/icon.svg',tag:d.tag||'alert',requireInteraction:!d.silent,silent:!!d.silent,vibrate:d.silent?undefined:[300,100,300,100,600],actions:[{action:'view',title:'מפה'},{action:'dismiss',title:'סגור'}]}))}catch{}});
self.addEventListener('notificationclick',e=>{e.notification.close();if(e.action==='dismiss')return;e.waitUntil(clients.matchAll({type:'window'}).then(cls=>{for(const c of cls)if(c.url.includes(self.location.origin))return c.focus();return clients.openWindow('/')}))});`;
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1a2236"/><stop offset="100%" stop-color="#0a0e17"/></radialGradient><radialGradient id="dot" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fef2f2"/><stop offset="60%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></radialGradient></defs><rect width="512" height="512" rx="100" fill="url(#bg)"/><circle cx="256" cy="256" r="200" fill="none" stroke="#ef4444" stroke-width="4" opacity="0.3"/><circle cx="256" cy="256" r="160" fill="none" stroke="#ef4444" stroke-width="4" opacity="0.5"/><circle cx="256" cy="256" r="120" fill="none" stroke="#ef4444" stroke-width="4" opacity="0.7"/><circle cx="256" cy="256" r="80" fill="url(#dot)"/><circle cx="256" cy="256" r="20" fill="#fff"/></svg>`;

// ── Prometheus metrics text format ───────────────────────────
function prometheusMetrics() {
  const mem = process.memoryUsage();
  const up = Math.floor((Date.now() - SERVER_START) / 1000);
  const m = (name, help, type, value) => `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${value}\n`;
  return [
    m('alertmap_uptime_seconds', 'Server uptime in seconds', 'counter', up),
    m('alertmap_memory_rss_bytes', 'Resident set size in bytes', 'gauge', mem.rss),
    m('alertmap_memory_heap_used_bytes', 'V8 heap used in bytes', 'gauge', mem.heapUsed),
    m('alertmap_requests_total', 'Total HTTP requests handled', 'counter', M.reqs),
    m('alertmap_alerts_total', 'Total alerts processed since start', 'counter', M.alerts),
    m('alertmap_oref_polls_total', 'Total OREF polls', 'counter', M.orefPolls),
    m('alertmap_oref_errors_total', 'Total OREF poll errors', 'counter', M.orefErrs),
    m('alertmap_oref_fallback_switches_total', 'Times the server switched to fallback', 'counter', M.fbSwitches),
    m('alertmap_oref_latency_ms', 'Latency of last OREF response', 'gauge', M.latMs),
    m('alertmap_active_alerts', 'Currently active alerts', 'gauge', activeAlerts.size),
    m('alertmap_sse_clients', 'Currently connected SSE clients', 'gauge', sseClients.size),
    m('alertmap_push_subscribers', 'Web Push subscribers', 'gauge', pushSubs.size),
    m('alertmap_push_sent_total', 'Web Push notifications sent', 'counter', M.pushSent),
    m('alertmap_push_errors_total', 'Web Push notifications failed', 'counter', M.pushErrs),
    m('alertmap_fallback_active', '1 if using fallback URL, 0 otherwise', 'gauge', useFB ? 1 : 0),
  ].join('');
}

// ── Embed widget loader (served at /embed.js) ────────────────
// External sites embed an iframe of the alertmap by including <script src=".../embed.js" data-city="...">
const EMBED_JS = `(function(){var s=document.currentScript;if(!s)return;var d=s.dataset||{};var o;try{o=new URL(s.src).origin}catch(e){return}var p=new URLSearchParams({embed:'1'});if(d.lang)p.set('lang',d.lang);if(d.theme)p.set('theme',d.theme);if(d.city)p.set('city',d.city);var i=document.createElement('iframe');i.src=o+'/?'+p.toString();i.style.width=d.width||'400px';i.style.height=d.height||'320px';i.style.border='0';i.style.borderRadius='8px';i.setAttribute('loading','lazy');i.setAttribute('title','Israel Alert Map');i.setAttribute('allow','notifications;geolocation');s.parentNode.insertBefore(i,s.nextSibling)})();`;

// ── Admin ───────────────────────────────────────────────────
function adminPage() { return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#0a0e17;color:#f1f5f9;padding:20px}h1{font-size:20px;margin-bottom:14px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px}.c{background:#1a2236;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px;text-align:center}.c .v{font-size:24px;font-weight:800;margin-bottom:2px}.c .l{font-size:10px;color:#94a3b8}.c.r .v{color:#ef4444}.c.g2 .v{color:#22c55e}.c.b .v{color:#3b82f6}.c.o .v{color:#f97316}.c.y .v{color:#eab308}.c.p .v{color:#a855f7}table{width:100%;border-collapse:collapse;background:#1a2236;border-radius:6px;overflow:hidden;font-size:11px;margin-bottom:12px}th,td{padding:6px 10px;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)}th{background:rgba(0,0,0,.3);color:#94a3b8}</style></head><body><h1>🛡️ Admin</h1><div class="g" id="cards"></div><table id="rt"><thead><tr><th>Route</th><th>#</th></tr></thead><tbody></tbody></table><script>async function L(){try{const r=await fetch('/api/admin/metrics');const d=await r.json();document.getElementById('cards').innerHTML=[{v:d.up,l:'Uptime',c:'g2'},{v:d.mem+'MB',l:'Memory',c:'b'},{v:d.sse,l:'SSE',c:'p'},{v:d.stored,l:'Alerts',c:'r'},{v:d.reqs,l:'Requests',c:'o'},{v:d.polls,l:'Polls',c:'b'},{v:d.errs,l:'Errors',c:'y'},{v:d.subs,l:'Push',c:'g2'},{v:d.fb?'YES':'NO',l:'Fallback',c:d.fb?'y':'g2'},{v:d.lat+'ms',l:'Latency',c:'b'},{v:d.wp?'✅':'❌',l:'web-push',c:d.wp?'g2':'r'},{v:d.hw?'✅':'❌',l:'Health WH',c:d.hw?'g2':'r'}].map(c=>'<div class="c '+c.c+'"><div class="v">'+c.v+'</div><div class="l">'+c.l+'</div></div>').join('');document.querySelector('#rt tbody').innerHTML=Object.entries(d.routes||{}).sort((a,b)=>b[1]-a[1]).map(([r,c])=>'<tr><td>'+r+'</td><td>'+c+'</td></tr>').join('')}catch{}}L();setInterval(L,5000)</script></body></html>`; }
function checkAuth(req) { const a = req.headers.authorization; if (!a || !a.startsWith('Basic ')) return false; try { const [u, p] = Buffer.from(a.slice(6), 'base64').toString().split(':'); return u === ADMIN_USER && p === ADMIN_PASS; } catch { return false; } }
function getIP(req) { return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '0.0.0.0'; }

// ── OREF proxy cache ─────────────────────────────────────────
// Prevents per-request hits to OREF for the /api/oref/* passthroughs (avoids accidental DoS upstream)
const orefCache = new Map(); // key -> { body, exp, inflight }
function proxyOref(key, url, ttlMs, req, res, p) {
  const now = Date.now();
  const entry = orefCache.get(key);
  if (entry && entry.body && entry.exp > now) { track(p, 200); return gz(req, res, entry.body, 'application/json; charset=utf-8'); }
  if (entry?.inflight) return entry.inflight.then(body => { track(p, 200); gz(req, res, body, 'application/json; charset=utf-8'); }).catch(() => { track(p, 502); res.writeHead(502); res.end('{"error":"fail"}'); });
  const inflight = fetchUrl(url).then(({ body }) => { orefCache.set(key, { body, exp: Date.now() + ttlMs }); return body; });
  orefCache.set(key, { ...(entry || {}), inflight });
  inflight.then(body => { track(p, 200); gz(req, res, body, 'application/json; charset=utf-8'); }).catch(() => { orefCache.delete(key); track(p, 502); res.writeHead(502); res.end('{"error":"fail"}'); });
}

// ── Tel Aviv real shelter data (live proxy, cached) ───────────────────
// Verified 2026-07: unlike the national data.gov.il CKAN catalog (which returns 0 results for
// public shelters), Tel Aviv-Yafo's own GIS backend publishes a real, queryable public-shelter
// layer (~374 records: lat/lon, address, fitness status) — see opendata.tel-aviv.gov.il and the
// underlying ArcGIS REST service below. This is the one concrete real-data source found so far;
// other cities still rely on the illustrative SHELTERS_DEFAULT samples in lib.js until a similar
// municipal feed is found and wired up for them too. Client merges this in via loadExternalShelters()
// only when the deployer hasn't set their own SHELTERS_URL (see index.html).
const TLV_SHELTERS_URL = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/WM/IView2WM/MapServer/592/query?where=1%3D1&outFields=lat,lon,Full_Address,t_sug,pail&f=json&resultRecordCount=1000&returnGeometry=false';
let tlvSheltersCache = null, tlvSheltersFetchedAt = 0, tlvSheltersInflight = null;
const TLV_SHELTERS_TTL = 24 * 3600 * 1000; // refresh at most once a day — considerate to the municipality's server
async function getTelAvivShelters() {
  const now = Date.now();
  if (tlvSheltersCache && (now - tlvSheltersFetchedAt) < TLV_SHELTERS_TTL) return tlvSheltersCache;
  if (tlvSheltersInflight) return tlvSheltersInflight;
  tlvSheltersInflight = (async () => {
    try {
      const { status, body } = await fetchUrl(TLV_SHELTERS_URL, { 'Accept': 'application/json' });
      if (status === 200) {
        const data = JSON.parse(body);
        const out = (data.features || []).map(f => f.attributes)
          .filter(a => typeof a.lat === 'number' && typeof a.lon === 'number' && (!a.pail || a.pail === 'כשיר לשימוש'))
          .map(a => ({ lat: a.lat, lng: a.lon, n: `${a.t_sug || 'מקלט'} — ${String(a.Full_Address || '').trim()}`.slice(0, 120) }));
        if (out.length) { tlvSheltersCache = out; tlvSheltersFetchedAt = Date.now(); }
      }
    } catch { /* keep serving stale cache, if any */ }
    tlvSheltersInflight = null;
    return tlvSheltersCache;
  })();
  return tlvSheltersInflight;
}

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (!rateOK(getIP(req))) { res.writeHead(429, { 'Retry-After': '60' }); track(req.url, 429); return res.end('{"error":"Rate limit"}'); }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  secHeaders(res, false); // basic headers for all responses; HTML routes call it again with html=true
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let url; try { url = new URL(req.url, `http://localhost:${PORT}`); } catch { res.writeHead(400); return res.end('bad'); }
  // API versioning: /api/v1/* is an alias for /api/*. Future versions can branch here.
  let p = url.pathname;
  if (p.startsWith('/api/v1/')) p = '/api/' + p.slice('/api/v1/'.length);

  if (p === '/admin') { if (!checkAuth(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin"' }); track(p, 401); return res.end('Auth'); } secHeaders(res, true); track(p, 200); return gz(req, res, adminPage(), 'text/html; charset=utf-8'); }
  if (p === '/api/admin/metrics') { if (!checkAuth(req)) { res.writeHead(401); return res.end('Auth'); } const mem = process.memoryUsage(); const up = Math.floor((Date.now() - SERVER_START) / 1000), h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60); track(p, 200); return gz(req, res, JSON.stringify({ up: `${h}h${m}m`, mem: Math.round(mem.rss / 1024 / 1024), sse: sseClients.size, stored: store.length, reqs: M.reqs, polls: M.orefPolls, errs: M.orefErrs, lat: M.latMs, fb: useFB, subs: pushSubs.size, sent: M.pushSent, wp: !!webpush, hw: !!HEALTH_WEBHOOK, routes: M.routes }), 'application/json; charset=utf-8'); }
  if (p === '/metrics') { if (!checkAuth(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Metrics"' }); track(p, 401); return res.end('Auth'); } track(p, 200); return gz(req, res, prometheusMetrics(), 'text/plain; version=0.0.4; charset=utf-8'); }

  if (p === '/manifest.json') { track(p, 200); return gz(req, res, MANIFEST, 'application/manifest+json; charset=utf-8'); }
  if (p === '/sw.js') { res.setHeader('Service-Worker-Allowed', '/'); res.setHeader('Cache-Control', 'no-cache'); track(p, 200); return gz(req, res, SW, 'application/javascript; charset=utf-8'); }
  if (p === '/embed.js') { res.setHeader('Cache-Control', 'public, max-age=3600'); track(p, 200); return gz(req, res, EMBED_JS, 'application/javascript; charset=utf-8'); }
  if (p === '/icon.svg' || p === '/favicon.ico') { res.setHeader('Cache-Control', 'public, max-age=86400'); track(p, 200); return gz(req, res, ICON, 'image/svg+xml; charset=utf-8'); }
  if (p === '/lib.js') { const lib = getLib(); if (lib) { res.setHeader('Cache-Control', 'no-cache'); track(p, 200); return gz(req, res, lib, 'application/javascript; charset=utf-8'); } track(p, 404); res.writeHead(404); return res.end('// lib.js not found'); }

  if (p === '/api/push/vapid-key') { track(p, 200); return gz(req, res, JSON.stringify({ publicKey: vapidKeys?.publicKey || null, available: !!webpush }), 'application/json; charset=utf-8'); }
  if (p === '/api/push/subscribe' && req.method === 'POST') { try { if (!webpush) { track(p, 503); res.writeHead(503); return res.end('{"error":"web-push not available on server"}'); } const b = await parseBody(req); const sub = b.subscription || b; if (!sub?.endpoint) throw new Error('no endpoint'); const favs = Array.isArray(b.favs) ? b.favs.map(c => String(c).slice(0, 100)).slice(0, 200) : []; pushSubs.set(sub.endpoint, { sub, favs, dnd: !!b.dnd }); saveSubs(); track(p, 201); res.writeHead(201, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); } catch (e) { track(p, 400); res.writeHead(400); return res.end(`{"error":"${String(e.message).replace(/"/g,"'")}"}`); } }
  if (p === '/api/push/unsubscribe' && req.method === 'POST') { try { const b = await parseBody(req); const endpoint = b.endpoint || b.subscription?.endpoint; if (endpoint) pushSubs.delete(endpoint); saveSubs(); track(p, 200); res.writeHead(200); return res.end('{"ok":true}'); } catch { track(p, 400); res.writeHead(400); return res.end('{"error":"bad"}'); } }

  if (p === '/api/health') { const mem = process.memoryUsage(); track(p, 200); return gz(req, res, JSON.stringify({ status: 'ok', uptime_seconds: Math.floor((Date.now() - SERVER_START) / 1000), memory_mb: Math.round(mem.rss / 1024 / 1024), sse_clients: sseClients.size, alerts_stored: store.length, fallback: useFB, web_push: !!webpush, push_subs: pushSubs.size, last_poll_ago: lastPoll ? Math.floor((Date.now() - lastPoll) / 1000) : null, health_webhook: !!HEALTH_WEBHOOK }), 'application/json; charset=utf-8'); }
  if (p === '/api/config') { track(p, 200); return gz(req, res, JSON.stringify({ shelters_url: SHELTERS_URL || null, web_push: !!webpush }), 'application/json; charset=utf-8'); }
  if (p === '/api/shelters/tel-aviv') { const s = await getTelAvivShelters(); track(p, 200); return gz(req, res, JSON.stringify(s || []), 'application/json; charset=utf-8'); }
  if (p === '/api/spec' || p === '/openapi.yaml') { try { const spec = fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8'); track(p, 200); return gz(req, res, spec, 'application/yaml; charset=utf-8'); } catch { track(p, 404); res.writeHead(404); return res.end('{"error":"spec not found"}'); } }
  if (p === '/api/alerts') { const a = [...activeAlerts.values()]; track(p, 200); return gz(req, res, JSON.stringify({ alerts: a, count: a.length, ts: new Date().toISOString() }), 'application/json; charset=utf-8'); }
  if (p === '/api/history') { const lim = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 200, 1), 1000); track(p, 200); return gz(req, res, JSON.stringify({ alerts: store.slice(0, lim), total: store.length }), 'application/json; charset=utf-8'); }
  if (p === '/api/oref/live') { proxyOref('live', OREF_URL, 1000, req, res, p); return; }
  if (p === '/api/oref/history') { proxyOref('history', OREF_HIST, 30000, req, res, p); return; }
  if (p === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    const a = [...activeAlerts.values()]; res.write(`data: ${JSON.stringify({ type: 'init', alerts: a })}\n\n`);
    let ls = JSON.stringify(a.map(a => a.id)); const cl = { res, ls }; sseClients.add(cl); track(p, 200);
    const iv = setInterval(() => { try { const c = [...activeAlerts.values()]; const ids = JSON.stringify(c.map(a => a.id)); if (ids !== cl.ls) { res.write(`data: ${JSON.stringify({ type: 'update', alerts: c })}\n\n`); cl.ls = ids; } else res.write(`: hb\n\n`); } catch { clearInterval(iv); sseClients.delete(cl); } }, 2000);
    req.on('close', () => { clearInterval(iv); sseClients.delete(cl); }); return;
  }
  if (p === '/api/stats') { const now = new Date(), ts = new Date(now.getFullYear(), now.getMonth(), now.getDate()), types = {}; store.forEach(a => { types[a.type] = (types[a.type] || 0) + 1; }); track(p, 200); return gz(req, res, JSON.stringify({ total: store.length, today: store.filter(a => new Date(a.timestamp) >= ts).length, lastHour: store.filter(a => new Date(a.timestamp) >= new Date(now - 3600000)).length, active: activeAlerts.size, sse: sseClients.size, types }), 'application/json; charset=utf-8'); }
  if (p === '/api/logs') { try { if (!fs.existsSync(LOG_FILE)) { track(p, 200); return gz(req, res, '(empty)', 'text/plain; charset=utf-8'); } const st = fs.statSync(LOG_FILE), mx = 500 * 1024; let c; if (st.size > mx) { const fd = fs.openSync(LOG_FILE, 'r'); const buf = Buffer.alloc(mx); fs.readSync(fd, buf, 0, mx, st.size - mx); fs.closeSync(fd); c = '...\n' + buf.toString('utf8'); } else c = fs.readFileSync(LOG_FILE, 'utf8'); track(p, 200); return gz(req, res, c, 'text/plain; charset=utf-8'); } catch (e) { track(p, 500); res.writeHead(500); return res.end(`{"error":"${e.message}"}`); } }
  if (p === '/' || p === '/index.html') { const isEmbed = url.searchParams.get('embed') === '1'; secHeaders(res, true, isEmbed); const html = getHtml(); if (html) { track('/', 200); return gz(req, res, html, 'text/html; charset=utf-8'); } }
  res.writeHead(404); track(p, 404); res.end('{"error":"Not found"}');
});

server.on('error', err => { if (err.code === 'EADDRINUSE') { console.error(`❌ Port ${PORT} in use — set PORT env to a free port`); process.exit(1); } });
server.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║  🚨 Alert Map v3 — http://localhost:${PORT}         ║`);
  console.log(`║  🛡️  /admin user: ${ADMIN_USER}                         ║`);
  console.log(`║  📡 web-push: ${webpush ? '✅' : '❌ npm i web-push'}                   ║`);
  console.log(`║  🔄 Fallback: ${FB_URL ? '✅' : '❌ set FALLBACK_ALERT_URL'}          ║`);
  console.log(`║  📣 Health WH: ${HEALTH_WEBHOOK ? '✅' : '❌ set HEALTH_WEBHOOK'}         ║`);
  console.log(`╚═══════════════════════════════════════════════╝`);
  if (ADMIN_PASS_GENERATED) {
    console.log(`\n  🔑 Generated admin password (set ADMIN_PASS to override): \x1b[1;33m${ADMIN_PASS}\x1b[0m`);
    console.log(`     Save it now — it changes on every restart until you set ADMIN_PASS.\n`);
  } else {
    console.log(`\n  🔑 /admin password: set via ADMIN_PASS env (hidden)\n`);
  }
});

// Kick off self-paced polling (no overlap, with exponential backoff on failures)
pollAlerts().finally(schedulePoll);

// Graceful shutdown: drain log, close SSE connections, stop the server
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n📴 ${signal} received — shutting down gracefully`);
  if (pollTimer) clearTimeout(pollTimer);
  if (snapTimer) clearTimeout(snapTimer);
  try { fs.writeFileSync(SNAP_F, JSON.stringify(store.slice(0, SNAP_MAX))); } catch {} // final flush
  sseClients.forEach(cl => { try { cl.res.end(); } catch {} });
  sseClients.clear();
  activeAlerts.clear();
  server.close(() => {
    if (logStream) try { logStream.end(); } catch {}
    process.exit(0);
  });
  // Force-exit after 5s if cleanup hangs
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

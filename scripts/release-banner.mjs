#!/usr/bin/env node
// Generates a branded release banner (1200x630) for a given version, using the app's own
// icon/color tokens so every release image looks consistent. Requires Chrome or Edge installed
// locally (dev-time only — not a runtime dependency of the app itself).
//
// Usage: node scripts/release-banner.mjs [version] [outFile]
//   version defaults to package.json's current version.
//   outFile defaults to release-banners/vX.Y.Z.png

import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = process.argv[2] || pkg.version;
const outFile = process.argv[3] || join(ROOT, 'release-banners', `v${version}.png`);

// Same radar-pulse mark used by the running app (server.js's ICON constant / public /icon.svg)
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1a2236"/><stop offset="100%" stop-color="#0a0e17"/></radialGradient><radialGradient id="dot" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fef2f2"/><stop offset="60%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></radialGradient></defs><rect width="512" height="512" rx="100" fill="url(#bg)"/><circle cx="256" cy="256" r="200" fill="none" stroke="#ef4444" stroke-width="4" opacity="0.3"/><circle cx="256" cy="256" r="160" fill="none" stroke="#ef4444" stroke-width="4" opacity="0.5"/><circle cx="256" cy="256" r="120" fill="none" stroke="#ef4444" stroke-width="4" opacity="0.7"/><circle cx="256" cy="256" r="80" fill="url(#dot)"/><circle cx="256" cy="256" r="20" fill="#fff"/></svg>`;

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Rubik:wght@600;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{background:radial-gradient(120% 130% at 20% 15%,#1a2236 0%,#0a0e17 60%);font-family:'Heebo',sans-serif;position:relative}
  .ring{position:absolute;border:2px solid #ef4444;border-radius:50%;opacity:.12;top:50%;left:22%;transform:translate(-50%,-50%)}
  .r1{width:520px;height:520px}.r2{width:760px;height:760px}.r3{width:1000px;height:1000px}
  .icon{position:absolute;left:70px;top:50%;transform:translateY(-50%);width:220px;height:220px;filter:drop-shadow(0 10px 40px rgba(239,68,68,.35))}
  .content{position:absolute;left:340px;top:50%;transform:translateY(-50%);right:60px}
  h1{font-family:'Rubik';font-weight:800;font-size:96px;color:#f1f5f9;line-height:1}
  .sub{font-family:'Rubik';font-weight:600;font-size:28px;color:#94a3b8;letter-spacing:6px;margin-top:6px;direction:ltr;text-align:right}
  .tag{font-size:22px;color:#94a3b8;margin-top:22px}
  .pill{display:inline-flex;align-items:center;gap:10px;margin-top:34px;background:linear-gradient(135deg,#ef4444,#991b1b);color:#fff;font-family:'Rubik';font-weight:800;font-size:34px;padding:12px 30px;border-radius:999px;direction:ltr;box-shadow:0 8px 24px rgba(239,68,68,.4)}
  .foot{position:absolute;bottom:26px;right:340px;font-size:16px;color:#64748b;direction:ltr}
</style></head><body>
  <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
  <div class="icon">${ICON_SVG}</div>
  <div class="content">
    <h1>צפיר</h1>
    <div class="sub">TZAFIR</div>
    <div class="tag">ניטור התרעות פיקוד העורף בזמן אמת</div>
    <div class="pill">v${version}</div>
  </div>
  <div class="foot">github.com/DrummingBird1/RedAlert</div>
</body></html>`;

const tmpHtml = join(mkdtempSync(join(tmpdir(), 'banner-')), 'banner.html');
writeFileSync(tmpHtml, html, 'utf8');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const CHROME = CHROME_CANDIDATES.find(existsSync);
if (!CHROME) { console.error('No Chrome/Edge install found in the usual locations.'); process.exit(1); }

const PORT = 9335 + Math.floor(Math.random() * 500);
const profileDir = mkdtempSync(join(tmpdir(), 'chrome-banner-'));
function log(...a) { console.log(new Date().toISOString(), ...a); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function withTimeout(p, ms, label) { return Promise.race([p, sleep(ms).then(() => { throw new Error('TIMEOUT: ' + label) })]); }

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*', `--user-data-dir=${profileDir}`,
  '--no-first-run', '--window-size=1200,630'
], { stdio: 'ignore' });

async function waitForCdp() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('CDP did not come up in time');
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map();
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
      }
    });
  }
  open() { return new Promise((res, rej) => { this.ws.addEventListener('open', res, { once: true }); this.ws.addEventListener('error', rej, { once: true }) }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })) }); }
}

async function main() {
  await withTimeout(waitForCdp(), 15000, 'waitForCdp');
  const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
  const target = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await withTimeout(cdp.open(), 10000, 'ws open');
  await withTimeout(cdp.send('Page.enable'), 10000, 'Page.enable');
  await withTimeout(cdp.send('Page.navigate', { url: 'file:///' + tmpHtml.replace(/\\/g, '/') }), 10000, 'Page.navigate');
  await sleep(1200); // let web fonts finish loading
  const shot = await withTimeout(cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }), 15000, 'captureScreenshot');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
  log('Saved', outFile, Buffer.from(shot.data, 'base64').length, 'bytes');
  try { cdp.ws.close(); } catch {}
  chrome.kill();
  process.exit(0);
}
main().catch(e => { log('FATAL', e.stack || e); try { chrome.kill(); } catch {}; process.exit(1); });
setTimeout(() => { log('WATCHDOG timeout'); try { chrome.kill(); } catch {}; process.exit(2); }, 30000);

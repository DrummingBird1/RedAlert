#!/usr/bin/env node
// ============================================================
//  Telegram Bot — מעביר אזעקות לערוץ טלגרם
//  הפעלה: TELEGRAM_TOKEN=xxx TELEGRAM_CHANNEL=@mychannel node telegram-bot.js
//  ללא תלויות: קריאה ל-Telegram Bot API (sendMessage) דרך https גולמי,
//  באותו סגנון כמו sendDiscord() ב-server.js — לא צריך npm install.
//  הקובץ בטוח ל-require() (בלי side effects) — test/unit.js בודק את buildMessage/escapeHtml.
// ============================================================

const https = require('https');

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHANNEL; // @channel_name or numeric chat_id
const API_URL = process.env.API_URL || 'http://localhost:3000';
const POLL_INTERVAL = 2000;
const MAX_SEND_ATTEMPTS = 3; // after this many failed sends of the same alert we give up on it (stops a 2s retry loop on a dead token)
const http = API_URL.startsWith('https') ? require('https') : require('http');
const knownIds = new Set();
const failCount = new Map(); // alert id -> failed send attempts

// The message is sent with parse_mode HTML, so anything from the feed must be escaped:
// a single city name containing "<" or "&" makes Telegram reject the WHOLE message (HTTP 400 "can't parse entities").
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Node 20+ reports a refused connection to "localhost" as an AggregateError with an EMPTY message (IPv6 + IPv4 attempts) —
// fall back to the code / first inner error so the log never prints a blank "שגיאה:".
function errMsg(e) {
  return (e && (e.message || e.code || (e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].code)))) || String(e);
}

const TYPE_EMOJI = {
  rockets: '🚀',
  uav: '✈️',
  earthquake: '🌍',
  tsunami: '🌊',
};

const TYPE_LABELS = {
  rockets: 'ירי רקטות וטילים',
  uav: 'חדירת כלי טיס עוין',
  earthquake: 'רעידת אדמה',
  tsunami: 'צונאמי',
};

function buildMessage(type, cities, apiUrl = API_URL) {
  const emoji = TYPE_EMOJI[type] || '🚨';
  const label = TYPE_LABELS[type] || type;
  const cityList = cities.map(escapeHtml).join(', ');
  return `${emoji} <b>צבע אדום — ${escapeHtml(label)}</b>\n\n` +
    `📍 ${cityList}\n\n` +
    `⏰ ${new Date().toLocaleTimeString('he-IL')}\n` +
    `🔗 <a href="${escapeHtml(apiUrl)}">מפת אזעקות</a>`;
}

// ── שליחה ל-Telegram Bot API (sendMessage) — POST https גולמי, בלי ספריית לקוח ──
function sendTelegramMessage(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ chat_id: CHANNEL, text, parse_mode: 'HTML', disable_web_page_preview: true });
    const req = https.request(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', timeout: 10000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
        let msg = `HTTP ${res.statusCode}`;
        try { const j = JSON.parse(Buffer.concat(chunks).toString()); if (j.description) msg = j.description; } catch {}
        reject(new Error(msg));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(payload);
    req.end();
  });
}

function fetchAlerts() {
  return new Promise((resolve, reject) => {
    http.get(`${API_URL}/api/alerts`, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve(data.alerts || []);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function poll() {
  try {
    const alerts = await fetchAlerts();
    const newAlerts = alerts.filter(a => !knownIds.has(a.id));

    if (newAlerts.length > 0) {
      // Group by type
      const grouped = {};
      newAlerts.forEach(a => {
        const type = a.type || 'rockets';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(a);
      });

      for (const [type, group] of Object.entries(grouped)) {
        const cities = group.map(a => a.city);
        try {
          await sendTelegramMessage(buildMessage(type, cities));
          group.forEach(a => { knownIds.add(a.id); failCount.delete(a.id); }); // marked known only AFTER a successful send, so a failed one is retried
          console.log(`📨 ${cities.length} אזעקות נשלחו לטלגרם: ${cities.join(', ')}`);
        } catch (e) {
          console.error('❌ שגיאת טלגרם:', errMsg(e));
          group.forEach(a => {
            const n = (failCount.get(a.id) || 0) + 1;
            if (n >= MAX_SEND_ATTEMPTS) { knownIds.add(a.id); failCount.delete(a.id); console.error(`   ↳ מוותר על ${a.city} אחרי ${n} ניסיונות`); }
            else failCount.set(a.id, n);
          });
        }
      }
    }

    // Clean old IDs (keep last 1000)
    if (knownIds.size > 1000) {
      const arr = [...knownIds];
      arr.slice(0, arr.length - 500).forEach(id => knownIds.delete(id));
    }
  } catch (e) {
    console.error('⚠️ שגיאת polling:', errMsg(e));
  }
}

function main() {
  if (!TOKEN || !CHANNEL) {
    console.error('❌ חובה להגדיר TELEGRAM_TOKEN ו-TELEGRAM_CHANNEL');
    console.error('   TELEGRAM_TOKEN=123:ABC TELEGRAM_CHANNEL=@mychannel node telegram-bot.js');
    process.exit(1);
  }
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  🤖 Telegram Alert Bot — פעיל              ║');
  console.log(`║  📡 API: ${API_URL.padEnd(31)}║`);
  console.log(`║  📢 Channel: ${String(CHANNEL).padEnd(27)}║`);
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  setInterval(poll, POLL_INTERVAL);
  poll();
}

if (require.main === module) main();

module.exports = { escapeHtml, errMsg, buildMessage };

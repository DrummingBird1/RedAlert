#!/usr/bin/env node
// ============================================================
//  Telegram Bot — מעביר אזעקות לערוץ טלגרם
//  התקנה: npm install node-telegram-bot-api
//  הפעלה: TELEGRAM_TOKEN=xxx TELEGRAM_CHANNEL=@mychannel node telegram-bot.js
// ============================================================

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHANNEL; // @channel_name or numeric chat_id
const API_URL = process.env.API_URL || 'http://localhost:3000';
const POLL_INTERVAL = 2000;

if (!TOKEN || !CHANNEL) {
  console.error('❌ חובה להגדיר TELEGRAM_TOKEN ו-TELEGRAM_CHANNEL');
  console.error('   TELEGRAM_TOKEN=123:ABC TELEGRAM_CHANNEL=@mychannel node telegram-bot.js');
  process.exit(1);
}

let TelegramBot;
try {
  TelegramBot = require('node-telegram-bot-api');
} catch {
  console.error('❌ חסר: npm install node-telegram-bot-api');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: false });
const http = API_URL.startsWith('https') ? require('https') : require('http');
const knownIds = new Set();

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
        grouped[type].push(a.city);
        knownIds.add(a.id);
      });

      for (const [type, cities] of Object.entries(grouped)) {
        const emoji = TYPE_EMOJI[type] || '🚨';
        const label = TYPE_LABELS[type] || type;
        const cityList = cities.join(', ');

        const message =
          `${emoji} <b>צבע אדום — ${label}</b>\n\n` +
          `📍 ${cityList}\n\n` +
          `⏰ ${new Date().toLocaleTimeString('he-IL')}\n` +
          `🔗 <a href="${API_URL}">מפת אזעקות</a>`;

        try {
          await bot.sendMessage(CHANNEL, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          });
          console.log(`📨 ${cities.length} אזעקות נשלחו לטלגרם: ${cityList}`);
        } catch (e) {
          console.error('❌ שגיאת טלגרם:', e.message);
        }
      }
    }

    // Clean old IDs (keep last 1000)
    if (knownIds.size > 1000) {
      const arr = [...knownIds];
      arr.slice(0, arr.length - 500).forEach(id => knownIds.delete(id));
    }
  } catch (e) {
    console.error('⚠️ שגיאת polling:', e.message);
  }
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

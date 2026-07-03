// ============================================================
//  lib.js — shared data + pure functions
//  Single source of truth for both the browser client (index.html)
//  and the Node test suite (test.js). UMD: works as <script src>
//  (exposes global `AlertLib`) and as require('./lib.js') in Node.
//
//  Loaded SYNCHRONOUSLY in index.html via a blocking <script> tag
//  placed before the inline script, so AlertLib is always defined
//  before any client code runs (no startup race).
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlertLib = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Static data ────────────────────────────────────────────
  // Cities: name -> { lat, lng, r: region, s: shelter seconds }
  const CITIES = {"שדרות":{lat:31.524,lng:34.596,r:"עוטף עזה",s:15},"נתיבות":{lat:31.422,lng:34.588,r:"דרום",s:15},"אופקים":{lat:31.315,lng:34.618,r:"דרום",s:15},"עוטף עזה - בארי":{lat:31.426,lng:34.494,r:"עוטף עזה",s:0},"עוטף עזה - רעים":{lat:31.392,lng:34.457,r:"עוטף עזה",s:0},"עוטף עזה - כיסופים":{lat:31.376,lng:34.399,r:"עוטף עזה",s:0},"עוטף עזה - ניר עוז":{lat:31.286,lng:34.39,r:"עוטף עזה",s:0},"עוטף עזה - יד מרדכי":{lat:31.584,lng:34.559,r:"עוטף עזה",s:15},"עוטף עזה - זיקים":{lat:31.612,lng:34.537,r:"עוטף עזה",s:15},"אשקלון":{lat:31.669,lng:34.574,r:"דרום",s:30},"אשדוד":{lat:31.801,lng:34.644,r:"דרום",s:45},"באר שבע":{lat:31.253,lng:34.792,r:"דרום",s:60},"קריית גת":{lat:31.61,lng:34.764,r:"שפלה",s:30},"ערד":{lat:31.259,lng:35.213,r:"דרום",s:60},"דימונה":{lat:31.07,lng:35.034,r:"דרום",s:60},"אילת":{lat:29.558,lng:34.952,r:"ערבה",s:180},"יבנה":{lat:31.876,lng:34.739,r:"שפלה",s:45},"גדרה":{lat:31.815,lng:34.779,r:"שפלה",s:45},"רחובות":{lat:31.893,lng:34.811,r:"מרכז",s:60},"נס ציונה":{lat:31.931,lng:34.799,r:"מרכז",s:60},"בית שמש":{lat:31.746,lng:34.989,r:"ירושלים",s:60},"מודיעין":{lat:31.897,lng:35.01,r:"מרכז",s:60},"ראשון לציון":{lat:31.973,lng:34.793,r:"מרכז",s:90},"לוד":{lat:31.953,lng:34.89,r:"מרכז",s:90},"רמלה":{lat:31.928,lng:34.863,r:"מרכז",s:90},"תל אביב":{lat:32.085,lng:34.782,r:"מרכז",s:90},"חולון":{lat:32.012,lng:34.776,r:"מרכז",s:90},"בת ים":{lat:32.019,lng:34.751,r:"מרכז",s:90},"רמת גן":{lat:32.07,lng:34.825,r:"מרכז",s:90},"גבעתיים":{lat:32.072,lng:34.812,r:"מרכז",s:90},"בני ברק":{lat:32.083,lng:34.834,r:"מרכז",s:90},"פתח תקווה":{lat:32.084,lng:34.888,r:"מרכז",s:90},"אור יהודה":{lat:32.031,lng:34.853,r:"מרכז",s:90},"ראש העין":{lat:32.083,lng:34.957,r:"מרכז",s:90},"נתניה":{lat:32.322,lng:34.853,r:"שרון",s:60},"הרצליה":{lat:32.166,lng:34.846,r:"שרון",s:90},"כפר סבא":{lat:32.175,lng:34.907,r:"שרון",s:90},"רעננה":{lat:32.184,lng:34.871,r:"שרון",s:90},"הוד השרון":{lat:32.155,lng:34.888,r:"שרון",s:90},"חדרה":{lat:32.434,lng:34.92,r:"שרון",s:60},"חיפה":{lat:32.794,lng:34.99,r:"חיפה",s:60},"קריית ביאליק":{lat:32.837,lng:35.081,r:"חיפה",s:60},"קריית אתא":{lat:32.809,lng:35.106,r:"חיפה",s:60},"נהריה":{lat:33.004,lng:35.098,r:"צפון",s:60},"עכו":{lat:32.933,lng:35.083,r:"צפון",s:60},"כרמיאל":{lat:32.913,lng:35.3,r:"צפון",s:60},"צפת":{lat:32.965,lng:35.496,r:"צפון",s:30},"טבריה":{lat:32.792,lng:35.531,r:"צפון",s:60},"עפולה":{lat:32.608,lng:35.293,r:"צפון",s:60},"קריית שמונה":{lat:33.207,lng:35.571,r:"צפון",s:30},"מטולה":{lat:33.28,lng:35.573,r:"צפון",s:0},"שלומי":{lat:33.073,lng:35.146,r:"צפון",s:15},"ירושלים":{lat:31.768,lng:35.214,r:"ירושלים",s:90},"מעלה אדומים":{lat:31.775,lng:35.299,r:"ירושלים",s:90},"אריאל":{lat:32.106,lng:35.187,r:"יו״ש",s:90}};

  // Alert type -> map icon/color/css class
  const TM = {rockets:{icon:'🚀',color:'#ef4444',css:'tr'},uav:{icon:'✈️',color:'#f97316',css:'tu'},earthquake:{icon:'🌍',color:'#eab308',css:'te'},tsunami:{icon:'🌊',color:'#3b82f6',css:'tt'}};

  // Region -> default shelter seconds (fallback when a city has no explicit value)
  const RS = {'עוטף עזה':15,'דרום':30,'שפלה':45,'שרון':60,'חיפה':60,'מרכז':90,'ירושלים':90,'צפון':60,'יו״ש':90,'ערבה':180};

  // Illustrative shelter samples ONLY — one approximate point per city center, NOT verified
  // individual shelter addresses (no open/queryable authoritative dataset exists as of this
  // writing; data.gov.il's CKAN API returns zero results for public shelters). For real
  // municipal shelter data, configure SHELTERS_URL server-side (see README) instead of
  // relying on or expanding this illustrative list.
  const SHELTERS_DEFAULT = [{lat:31.524,lng:34.596,n:'שדרות (לדוגמה)'},{lat:31.422,lng:34.588,n:'נתיבות (לדוגמה)'},{lat:31.669,lng:34.574,n:'אשקלון (לדוגמה)'},{lat:31.801,lng:34.644,n:'אשדוד (לדוגמה)'},{lat:31.253,lng:34.792,n:'באר שבע (לדוגמה)'},{lat:31.61,lng:34.764,n:'קריית גת (לדוגמה)'},{lat:29.558,lng:34.952,n:'אילת (לדוגמה)'},{lat:31.876,lng:34.739,n:'יבנה (לדוגמה)'},{lat:31.893,lng:34.811,n:'רחובות (לדוגמה)'},{lat:31.973,lng:34.793,n:'ראשון לציון (לדוגמה)'},{lat:31.953,lng:34.89,n:'לוד (לדוגמה)'},{lat:32.085,lng:34.782,n:'תל אביב — דיזנגוף (לדוגמה)'},{lat:32.074,lng:34.778,n:'תל אביב — רוטשילד (לדוגמה)'},{lat:32.012,lng:34.776,n:'חולון (לדוגמה)'},{lat:32.019,lng:34.751,n:'בת ים (לדוגמה)'},{lat:32.07,lng:34.825,n:'רמת גן (לדוגמה)'},{lat:32.083,lng:34.834,n:'בני ברק (לדוגמה)'},{lat:32.084,lng:34.888,n:'פתח תקווה (לדוגמה)'},{lat:32.322,lng:34.853,n:'נתניה (לדוגמה)'},{lat:32.166,lng:34.846,n:'הרצליה (לדוגמה)'},{lat:32.175,lng:34.907,n:'כפר סבא (לדוגמה)'},{lat:32.184,lng:34.871,n:'רעננה (לדוגמה)'},{lat:32.434,lng:34.92,n:'חדרה (לדוגמה)'},{lat:32.794,lng:34.99,n:'חיפה (לדוגמה)'},{lat:32.837,lng:35.081,n:'קריית ביאליק (לדוגמה)'},{lat:33.004,lng:35.098,n:'נהריה (לדוגמה)'},{lat:32.933,lng:35.083,n:'עכו (לדוגמה)'},{lat:32.913,lng:35.3,n:'כרמיאל (לדוגמה)'},{lat:32.965,lng:35.496,n:'צפת (לדוגמה)'},{lat:32.792,lng:35.531,n:'טבריה (לדוגמה)'},{lat:33.207,lng:35.571,n:'קריית שמונה (לדוגמה)'},{lat:31.768,lng:35.214,n:'ירושלים (לדוגמה)'},{lat:31.775,lng:35.299,n:'מעלה אדומים (לדוגמה)'},{lat:32.106,lng:35.187,n:'אריאל (לדוגמה)'},{lat:31.897,lng:35.01,n:'מודיעין (לדוגמה)'}];

  // i18n strings (he/en/ar/ru). Hebrew is the fallback for any missing key.
  const LN = {he:{rockets:'ירי רקטות',uav:'כלי טיס עוין',earthquake:'רעידת אדמה',tsunami:'צונאמי',imm:'מיד',sec:'שניות',min:'דקות',minSingle:'דקה',active:'פעיל',km:'ק״מ',remaining:'נותרו',passed:'עבר',allClear:'הכל שקט',noAlerts:'אין אזעקות',noResults:'אין תוצאות',more:'עוד',now:'עכשיו',todayL:'היום',yesterdayL:'אתמול',weekAvg:'ממוצע',ttsPrefix:'צבע אדום ב',unknownLoc:'מיקום לא ידוע',donate:'תמכו בפרויקט',donateD:'הפרויקט חינמי וקוד פתוח. תרומה עוזרת לכסות שרתים ופיתוח 💛',donateBtn:'תרומה ב-Patreon'},en:{rockets:'Rockets',uav:'UAV',earthquake:'Earthquake',tsunami:'Tsunami',imm:'Now',sec:'s',min:'min',minSingle:'min',active:'Active',km:'km',remaining:'left',passed:'done',allClear:'All Clear',noAlerts:'No alerts',noResults:'No results',more:'More',now:'Now',todayL:'Today',yesterdayL:'Yesterday',weekAvg:'Avg',ttsPrefix:'Red alert in ',unknownLoc:'Unknown location',donate:'Support the project',donateD:'This project is free and open-source. A donation helps cover servers and development 💛',donateBtn:'Donate on Patreon'},ar:{rockets:'صواريخ',uav:'طائرة',earthquake:'زلزال',tsunami:'تسونامي',imm:'فوراً',sec:'ث',min:'د',minSingle:'د',active:'نشط',km:'كم',remaining:'متبقي',passed:'انتهى',allClear:'هادئ',noAlerts:'لا إنذارات',noResults:'لا نتائج',more:'المزيد',now:'الآن',todayL:'اليوم',yesterdayL:'أمس',weekAvg:'متوسط',ttsPrefix:'إنذار أحمر في ',unknownLoc:'موقع غير معروف',donate:'ادعم المشروع',donateD:'هذا المشروع مجاني ومفتوح المصدر. تبرعك يساعد في تغطية الخوادم والتطوير 💛',donateBtn:'تبرّع عبر Patreon'},ru:{rockets:'Ракеты',uav:'БПЛА',earthquake:'Землетрясение',tsunami:'Цунами',imm:'Сейчас',sec:'с',min:'мин',minSingle:'мин',active:'Активно',km:'км',remaining:'осталось',passed:'прошло',allClear:'Спокойно',noAlerts:'Нет тревог',noResults:'Пусто',more:'Ещё',now:'Сейчас',todayL:'Сегодня',yesterdayL:'Вчера',weekAvg:'Средн.',ttsPrefix:'Красная тревога в ',unknownLoc:'Неизвестное место',donate:'Поддержать проект',donateD:'Проект бесплатный и с открытым кодом. Донат помогает оплачивать серверы и разработку 💛',donateBtn:'Поддержать на Patreon'}};

  // ── Pure functions ─────────────────────────────────────────

  // Escape user/OREF-supplied text before inserting into HTML.
  function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Format shelter time. `L` = label set { imm, sec, min, minSingle } (caller passes translated strings).
  function formatShelter(s, L) {
    L = L || { imm: 'מיד', sec: 'שניות', min: 'דקות', minSingle: 'דקה' };
    if (s === 0) return L.imm;
    if (s < 60) return s + ' ' + L.sec;
    const m = s / 60;
    const lbl = (m === 1) ? L.minSingle : L.min;
    return (m % 1 === 0 ? m : m.toFixed(1)) + ' ' + lbl;
  }

  // Urgency bucket from shelter seconds.
  function shelterClass(s) {
    if (s <= 15) return 'immediate';
    if (s <= 30) return 'fast';
    if (s <= 60) return 'medium';
    return 'slow';
  }

  // Haversine distance in km.
  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Do-not-disturb window check (23:00–06:59), gated by `enabled`.
  function isDND(hour, enabled) {
    if (!enabled) return false;
    return hour >= 23 || hour < 7;
  }

  // Normalize a city name for fuzzy comparison (strip separators/quotes, collapse spaces).
  function normalizeCity(n) {
    return n.trim().replace(/[-–—]/g, ' ').replace(/['"״׳]/g, '').replace(/\s+/g, ' ');
  }

  // Fuzzy-match a city name against the keys of `cities`. Returns the matched KEY or null.
  // Order: exact -> normalized-equal -> substring (either direction) -> word overlap.
  function fuzzyMatch(name, cities) {
    if (cities[name]) return name;
    const n = normalizeCity(name);
    for (const k of Object.keys(cities)) if (normalizeCity(k) === n) return k;
    for (const k of Object.keys(cities)) { const nk = normalizeCity(k); if (n.includes(nk) || nk.includes(n)) return k; }
    const w = n.split(' ');
    for (const k of Object.keys(cities)) { const kw = normalizeCity(k).split(' '); if (w.some(x => x.length > 2 && kw.some(y => y.includes(x) || x.includes(y)))) return k; }
    return null;
  }

  return {
    CITIES, TM, RS, SHELTERS_DEFAULT, LN,
    escapeHtml, formatShelter, shelterClass, distanceKm, isDND, normalizeCity, fuzzyMatch,
  };
}));

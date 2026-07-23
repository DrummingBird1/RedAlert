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

  // i18n strings (14 languages). Hebrew is the fallback for any missing key.
  // Community relevance driving the 2026-07 expansion beyond he/en/ar/ru: Amharic (am) and
  // Tigrinya (ti) — Ethiopian-Israeli and Eritrean asylum-seeker communities; Thai (th) and
  // Tagalog (tl) — foreign agricultural/caregiving workers; Ukrainian (uk) — recent olim/refugees;
  // French (fr)/Spanish (es)/Romanian (ro) — established oleh communities; Hindi (hi)/Chinese (zh)
  // — growing worker communities. NOTE: am/ti translations are best-effort (lower-resource
  // languages for MT); a native speaker review is recommended before relying on them operationally.
  const LN = {he:{rockets:'ירי רקטות',uav:'כלי טיס עוין',earthquake:'רעידת אדמה',tsunami:'צונאמי',imm:'מיד',sec:'שניות',min:'דקות',minSingle:'דקה',active:'פעיל',km:'ק״מ',remaining:'נותרו',passed:'עבר',allClear:'הכל שקט',noAlerts:'אין אזעקות',noResults:'אין תוצאות',more:'עוד',now:'עכשיו',todayL:'היום',yesterdayL:'אתמול',weekAvg:'ממוצע',ttsPrefix:'צבע אדום ב',unknownLoc:'מיקום לא ידוע',donate:'תמכו בפרויקט',donateD:'הפרויקט חינמי וקוד פתוח. תרומה עוזרת לכסות שרתים ופיתוח 💛',donateBtn:'תרומה ב-Patreon',title:'צפיר',tagline:'ניטור התרעות בזמן אמת',history:'היסטוריה',updates:'עדכונים',searchPlaceholder:'חיפוש עיר...',dateAll:'הכל',dateToday:'היום',dateYesterday:'אתמול',dateWeek:'שבוע',dateMonth:'חודש',whatsNew:'מה חדש',gotIt:'הבנתי'},en:{rockets:'Rockets',uav:'UAV',earthquake:'Earthquake',tsunami:'Tsunami',imm:'Now',sec:'s',min:'min',minSingle:'min',active:'Active',km:'km',remaining:'left',passed:'done',allClear:'All Clear',noAlerts:'No alerts',noResults:'No results',more:'More',now:'Now',todayL:'Today',yesterdayL:'Yesterday',weekAvg:'Avg',ttsPrefix:'Red alert in ',unknownLoc:'Unknown location',donate:'Support the project',donateD:'This project is free and open-source. A donation helps cover servers and development 💛',donateBtn:'Donate on Patreon',title:'Tzafir',tagline:'Real-time alert monitoring',history:'History',updates:'Updates',searchPlaceholder:'Search city...',dateAll:'All',dateToday:'Today',dateYesterday:'Yesterday',dateWeek:'Week',dateMonth:'Month',whatsNew:"What's New",gotIt:'Got it'},ar:{rockets:'صواريخ',uav:'طائرة',earthquake:'زلزال',tsunami:'تسونامي',imm:'فوراً',sec:'ث',min:'د',minSingle:'د',active:'نشط',km:'كم',remaining:'متبقي',passed:'انتهى',allClear:'هادئ',noAlerts:'لا إنذارات',noResults:'لا نتائج',more:'المزيد',now:'الآن',todayL:'اليوم',yesterdayL:'أمس',weekAvg:'متوسط',ttsPrefix:'إنذار أحمر في ',unknownLoc:'موقع غير معروف',donate:'ادعم المشروع',donateD:'هذا المشروع مجاني ومفتوح المصدر. تبرعك يساعد في تغطية الخوادم والتطوير 💛',donateBtn:'تبرّع عبر Patreon',title:'Tzafir',tagline:'مراقبة الإنذارات في الوقت الفعلي',history:'السجل',updates:'التحديثات',searchPlaceholder:'ابحث عن مدينة...',dateAll:'الكل',dateToday:'اليوم',dateYesterday:'أمس',dateWeek:'أسبوع',dateMonth:'شهر',whatsNew:'ما الجديد',gotIt:'فهمت'},ru:{rockets:'Ракеты',uav:'БПЛА',earthquake:'Землетрясение',tsunami:'Цунами',imm:'Сейчас',sec:'с',min:'мин',minSingle:'мин',active:'Активно',km:'км',remaining:'осталось',passed:'прошло',allClear:'Спокойно',noAlerts:'Нет тревог',noResults:'Пусто',more:'Ещё',now:'Сейчас',todayL:'Сегодня',yesterdayL:'Вчера',weekAvg:'Средн.',ttsPrefix:'Красная тревога в ',unknownLoc:'Неизвестное место',donate:'Поддержать проект',donateD:'Проект бесплатный и с открытым кодом. Донат помогает оплачивать серверы и разработку 💛',donateBtn:'Поддержать на Patreon',title:'Tzafir',tagline:'Мониторинг тревог в реальном времени',history:'История',updates:'Обновления',searchPlaceholder:'Поиск города...',dateAll:'Все',dateToday:'Сегодня',dateYesterday:'Вчера',dateWeek:'Неделя',dateMonth:'Месяц',whatsNew:'Что нового',gotIt:'Понятно'},am:{rockets:'ሮኬቶች',uav:'ድሮን',earthquake:'የመሬት መንቀጥቀጥ',tsunami:'ትሱናሚ',imm:'አሁኑኑ',sec:'ሰ',min:'ደ',minSingle:'ደቂቃ',active:'ንቁ',km:'ኪ.ሜ',remaining:'ቀሪ',passed:'አልፏል',allClear:'ጸጥታ ሰፍኗል',noAlerts:'ማንቂያ የለም',noResults:'ውጤት የለም',more:'ተጨማሪ',now:'አሁን',todayL:'ዛሬ',yesterdayL:'ትናንት',weekAvg:'አማካይ',ttsPrefix:'ቀይ ማንቂያ በ',unknownLoc:'ያልታወቀ ቦታ',donate:'ፕሮጀክቱን ይደግፉ',donateD:'ይህ ፕሮጀክት ነጻ እና ክፍት ምንጭ ነው። ልገሳ አገልጋዮችን እና ልማትን ለመሸፈን ይረዳል 💛',donateBtn:'በ Patreon ይለግሱ',title:'Tzafir',tagline:'የቅጽበታዊ ማንቂያ ክትትል',history:'ታሪክ',updates:'ዝማኔዎች',searchPlaceholder:'ከተማ ይፈልጉ...',dateAll:'ሁሉም',dateToday:'ዛሬ',dateYesterday:'ትናንት',dateWeek:'ሳምንት',dateMonth:'ወር',whatsNew:'አዲስ ነገር',gotIt:'ገባኝ'},ti:{rockets:'ሮኬታት',uav:'ድሮን',earthquake:'ምንቅጥቃጥ ምድሪ',tsunami:'ትሱናሚ',imm:'ሕጂ',sec:'ካ',min:'ደ',minSingle:'ደቒቕ',active:'ንጡፍ',km:'ኪ.ሜ',remaining:'ተሪፉ',passed:'ሓሊፉ',allClear:'ህድእ ኢሉ',noAlerts:'ምልክታት የለን',noResults:'ውጽኢት የለን',more:'ተወሳኺ',now:'ሕጂ',todayL:'ሎሚ',yesterdayL:'ትማሊ',weekAvg:'መበል',ttsPrefix:'ቀይሕ ሓደጋ ኣብ ',unknownLoc:'ዘይፍለጥ ቦታ',donate:'ነዚ ፕሮጀክት ደግፍ',donateD:'እዚ ፕሮጀክት ብነጻን ክፉት ምንጭን እዩ። ውህበት ንኣገልገልቲን ልምዓትን ይሕግዝ 💛',donateBtn:'ኣብ Patreon ለግስ',title:'Tzafir',tagline:'ናይ ሓደጋ ክትትል ብህሞት',history:'ታሪኽ',updates:'ሓድሽ መረጃ',searchPlaceholder:'ከተማ ድለ...',dateAll:'ኩሉ',dateToday:'ሎሚ',dateYesterday:'ትማሊ',dateWeek:'ሰሙን',dateMonth:'ወርሒ',whatsNew:'እንታይ ሓድሽ',gotIt:'ተረዲኡኒ'},th:{rockets:'จรวด',uav:'โดรน',earthquake:'แผ่นดินไหว',tsunami:'สึนามิ',imm:'ทันที',sec:'วิ',min:'นาที',minSingle:'นาที',active:'กำลังเกิดขึ้น',km:'กม.',remaining:'เหลือ',passed:'ผ่านไปแล้ว',allClear:'ปลอดภัยแล้ว',noAlerts:'ไม่มีการแจ้งเตือน',noResults:'ไม่พบผลลัพธ์',more:'เพิ่มเติม',now:'ตอนนี้',todayL:'วันนี้',yesterdayL:'เมื่อวาน',weekAvg:'เฉลี่ย',ttsPrefix:'เตือนภัยสีแดงที่ ',unknownLoc:'ไม่ทราบตำแหน่ง',donate:'สนับสนุนโครงการ',donateD:'โครงการนี้ฟรีและโอเพนซอร์ส การบริจาคช่วยครอบคลุมค่าเซิร์ฟเวอร์และการพัฒนา 💛',donateBtn:'บริจาคผ่าน Patreon',title:'Tzafir',tagline:'ระบบติดตามการแจ้งเตือนแบบเรียลไทม์',history:'ประวัติ',updates:'อัปเดต',searchPlaceholder:'ค้นหาเมือง...',dateAll:'ทั้งหมด',dateToday:'วันนี้',dateYesterday:'เมื่อวาน',dateWeek:'สัปดาห์',dateMonth:'เดือน',whatsNew:'มีอะไรใหม่',gotIt:'เข้าใจแล้ว'},tl:{rockets:'Rocket',uav:'Drone',earthquake:'Lindol',tsunami:'Tsunami',imm:'Ngayon din',sec:'s',min:'min',minSingle:'min',active:'Aktibo',km:'km',remaining:'natitira',passed:'tapos na',allClear:'Ligtas na',noAlerts:'Walang alerto',noResults:'Walang resulta',more:'Higit pa',now:'Ngayon',todayL:'Ngayong araw',yesterdayL:'Kahapon',weekAvg:'Avg.',ttsPrefix:'Red alert sa ',unknownLoc:'Hindi alam ang lokasyon',donate:'Suportahan ang proyekto',donateD:'Libre at open-source ang proyektong ito. Ang donasyon ay nakakatulong sa server at development 💛',donateBtn:'Mag-donate sa Patreon',title:'Tzafir',tagline:'Real-time na pagmomonitor ng alerto',history:'Kasaysayan',updates:'Mga Update',searchPlaceholder:'Maghanap ng lungsod...',dateAll:'Lahat',dateToday:'Ngayong araw',dateYesterday:'Kahapon',dateWeek:'Linggo',dateMonth:'Buwan',whatsNew:'Bago dito',gotIt:'Nakuha ko'},uk:{rockets:'Ракети',uav:'БПЛА',earthquake:'Землетрус',tsunami:'Цунамі',imm:'Зараз',sec:'с',min:'хв',minSingle:'хв',active:'Активно',km:'км',remaining:'залишилось',passed:'минуло',allClear:'Спокійно',noAlerts:'Немає тривог',noResults:'Немає результатів',more:'Більше',now:'Зараз',todayL:'Сьогодні',yesterdayL:'Вчора',weekAvg:'Серед.',ttsPrefix:'Червона тривога в ',unknownLoc:'Невідоме місце',donate:'Підтримати проєкт',donateD:'Цей проєкт безкоштовний і з відкритим кодом. Донат допомагає оплачувати сервери та розробку 💛',donateBtn:'Підтримати на Patreon',title:'Tzafir',tagline:'Моніторинг тривог у реальному часі',history:'Історія',updates:'Оновлення',searchPlaceholder:'Пошук міста...',dateAll:'Все',dateToday:'Сьогодні',dateYesterday:'Вчора',dateWeek:'Тиждень',dateMonth:'Місяць',whatsNew:'Що нового',gotIt:'Зрозуміло'},fr:{rockets:'Roquettes',uav:'Drone',earthquake:'Tremblement de terre',tsunami:'Tsunami',imm:'Immédiat',sec:'s',min:'min',minSingle:'min',active:'Actif',km:'km',remaining:'restant',passed:'terminé',allClear:'Tout est calme',noAlerts:'Aucune alerte',noResults:'Aucun résultat',more:'Plus',now:'Maintenant',todayL:"Aujourd'hui",yesterdayL:'Hier',weekAvg:'Moy.',ttsPrefix:'Alerte rouge à ',unknownLoc:'Emplacement inconnu',donate:'Soutenir le projet',donateD:'Ce projet est gratuit et open-source. Un don aide à couvrir les serveurs et le développement 💛',donateBtn:'Faire un don sur Patreon',title:'Tzafir',tagline:'Surveillance des alertes en temps réel',history:'Historique',updates:'Mises à jour',searchPlaceholder:'Rechercher une ville...',dateAll:'Tout',dateToday:"Aujourd'hui",dateYesterday:'Hier',dateWeek:'Semaine',dateMonth:'Mois',whatsNew:'Quoi de neuf',gotIt:'Compris'},es:{rockets:'Cohetes',uav:'Dron',earthquake:'Terremoto',tsunami:'Tsunami',imm:'Inmediato',sec:'s',min:'min',minSingle:'min',active:'Activo',km:'km',remaining:'restante',passed:'terminado',allClear:'Todo tranquilo',noAlerts:'Sin alertas',noResults:'Sin resultados',more:'Más',now:'Ahora',todayL:'Hoy',yesterdayL:'Ayer',weekAvg:'Prom.',ttsPrefix:'Alerta roja en ',unknownLoc:'Ubicación desconocida',donate:'Apoya el proyecto',donateD:'Este proyecto es gratuito y de código abierto. Una donación ayuda a cubrir servidores y desarrollo 💛',donateBtn:'Donar en Patreon',title:'Tzafir',tagline:'Monitoreo de alertas en tiempo real',history:'Historial',updates:'Actualizaciones',searchPlaceholder:'Buscar ciudad...',dateAll:'Todo',dateToday:'Hoy',dateYesterday:'Ayer',dateWeek:'Semana',dateMonth:'Mes',whatsNew:'Novedades',gotIt:'Entendido'},ro:{rockets:'Rachete',uav:'Dronă',earthquake:'Cutremur',tsunami:'Tsunami',imm:'Imediat',sec:'s',min:'min',minSingle:'min',active:'Activ',km:'km',remaining:'rămas',passed:'trecut',allClear:'Totul e liniștit',noAlerts:'Nicio alertă',noResults:'Niciun rezultat',more:'Mai mult',now:'Acum',todayL:'Azi',yesterdayL:'Ieri',weekAvg:'Medie',ttsPrefix:'Alertă roșie în ',unknownLoc:'Locație necunoscută',donate:'Susține proiectul',donateD:'Acest proiect este gratuit și open-source. O donație ajută la acoperirea serverelor și dezvoltării 💛',donateBtn:'Donează pe Patreon',title:'Tzafir',tagline:'Monitorizare alerte în timp real',history:'Istoric',updates:'Actualizări',searchPlaceholder:'Caută oraș...',dateAll:'Tot',dateToday:'Azi',dateYesterday:'Ieri',dateWeek:'Săptămână',dateMonth:'Lună',whatsNew:'Noutăți',gotIt:'Am înțeles'},hi:{rockets:'रॉकेट',uav:'ड्रोन',earthquake:'भूकंप',tsunami:'सुनामी',imm:'अभी',sec:'सेकंड',min:'मिनट',minSingle:'मिनट',active:'सक्रिय',km:'किमी',remaining:'शेष',passed:'समाप्त',allClear:'सब शांत',noAlerts:'कोई अलर्ट नहीं',noResults:'कोई परिणाम नहीं',more:'और',now:'अभी',todayL:'आज',yesterdayL:'कल',weekAvg:'औसत',ttsPrefix:'रेड अलर्ट: ',unknownLoc:'अज्ञात स्थान',donate:'प्रोजेक्ट को सपोर्ट करें',donateD:'यह प्रोजेक्ट मुफ़्त और ओपन-सोर्स है। दान सर्वर और विकास में मदद करता है 💛',donateBtn:'Patreon पर दान करें',title:'Tzafir',tagline:'रीयल-टाइम अलर्ट मॉनिटरिंग',history:'इतिहास',updates:'अपडेट्स',searchPlaceholder:'शहर खोजें...',dateAll:'सभी',dateToday:'आज',dateYesterday:'कल',dateWeek:'सप्ताह',dateMonth:'महीना',whatsNew:'नया क्या है',gotIt:'समझ गया'},zh:{rockets:'火箭弹',uav:'无人机',earthquake:'地震',tsunami:'海啸',imm:'立即',sec:'秒',min:'分钟',minSingle:'分钟',active:'进行中',km:'公里',remaining:'剩余',passed:'已过',allClear:'解除警报',noAlerts:'无警报',noResults:'无结果',more:'更多',now:'现在',todayL:'今天',yesterdayL:'昨天',weekAvg:'平均',ttsPrefix:'红色警报，地点：',unknownLoc:'未知位置',donate:'支持本项目',donateD:'本项目免费且开源。捐款有助于支付服务器和开发费用 💛',donateBtn:'在 Patreon 上捐款',title:'Tzafir',tagline:'实时警报监控',history:'历史记录',updates:'更新',searchPlaceholder:'搜索城市...',dateAll:'全部',dateToday:'今天',dateYesterday:'昨天',dateWeek:'本周',dateMonth:'本月',whatsNew:'新功能',gotIt:'知道了'}};

  // Language picker metadata (native name + flag) — index.html builds <select id="langS"> from this.
  const LANG_META = {he:{n:'עברית',f:'🇮🇱'},en:{n:'English',f:'🇺🇸'},ar:{n:'العربية',f:'🇸🇦'},ru:{n:'Русский',f:'🇷🇺'},am:{n:'አማርኛ',f:'🇪🇹'},ti:{n:'ትግርኛ',f:'🇪🇷'},th:{n:'ไทย',f:'🇹🇭'},tl:{n:'Filipino',f:'🇵🇭'},uk:{n:'Українська',f:'🇺🇦'},fr:{n:'Français',f:'🇫🇷'},es:{n:'Español',f:'🇪🇸'},ro:{n:'Română',f:'🇷🇴'},hi:{n:'हिन्दी',f:'🇮🇳'},zh:{n:'中文',f:'🇨🇳'}};

  // BCP-47 locale per language, for SpeechSynthesisUtterance.lang in the client's TTS announcer.
  const TTS_LOCALE = {he:'he-IL',en:'en-US',ar:'ar-SA',ru:'ru-RU',am:'am-ET',ti:'ti-ET',th:'th-TH',tl:'fil-PH',uk:'uk-UA',fr:'fr-FR',es:'es-ES',ro:'ro-RO',hi:'hi-IN',zh:'zh-CN'};

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
    CITIES, TM, RS, SHELTERS_DEFAULT, LN, LANG_META, TTS_LOCALE,
    escapeHtml, formatShelter, shelterClass, distanceKm, isDND, normalizeCity, fuzzyMatch,
  };
}));

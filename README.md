# 🚨 מפת אזעקות ישראל — צבע אדום | Israel Alert Map

<div align="center">

**מערכת ניטור אזעקות בזמן אמת עם מפה אינטראקטיבית**
**Real-time alert monitoring with interactive map**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Zero Dependencies](https://img.shields.io/badge/Core_Dependencies-Zero-blue)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](Dockerfile)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

</div>

> ⚠️ **מערכת זו למטרות מידע בלבד ואינה מחליפה הנחיות פיקוד העורף.**

---

## 🎯 מה זה?

אפליקציית ווב בזמן אמת שמציגה אזעקות פיקוד העורף על מפה אינטראקטיבית. שרת Node.js proxy + SSE, ללא תלויות חיצוניות (core), עם PWA להתקנה כאפליקציה.

## 🚀 הפעלה מהירה

```bash
git clone https://github.com/YOUR_USER/israel-alert-map.git
cd israel-alert-map
node server.js
# → http://localhost:3000
```

### עם Docker

```bash
docker-compose up -d
```

### עם תוספות אופציונליות

```bash
npm install                    # web-push + telegram bot
ADMIN_PASS=secret node server.js
```

---

## ✨ תכונות (30+)

### מפה וויזואליזציה
- 🗺️ **מפה אינטראקטיבית** — Leaflet.js עם dark/light tiles
- 📍 **מרקרים אנימטיביים** — פעימה אדומה לאזעקות פעילות, אפור להיסטוריה
- 🧲 **Marker Clustering** — קיבוץ מרקרים אוטומטי בזום רחוק
- 🔥 **מפת חום** — שכבה ויזואלית לאזורים עם ריכוז אזעקות
- 🏛️ **מקלטים ציבוריים** — שכבת מקלטים על המפה (12+ לדוגמה)
- 📍 **המיקום שלי** — GPS + מרחק בק"מ מכל אזעקה

### אזעקות ומידע
- ⏱️ **זמן מיגון** — לכל ישוב (~57 ישובים מובנים) לפי נתוני פיקוד העורף
- ⏳ **ספירה לאחור חיה** — "נותרו 23 שניות" על כל אזעקה פעילה
- 🛡️ **הנחיות התגוננות** — פאנל ירוק עם הנחיות + countdown מרכזי
- 🔍 **Fuzzy city matching** — "תל אביב - יפו" מוצא "תל אביב"
- 🔎 **סינון** — לפי אזור, סוג אזעקה, וטווח זמן

### התראות
- 🔔 **Push Notifications** — התראות מערכת (Browser Notification API)
- 📡 **Web Push** — VAPID keys + Service Worker (עם `npm i web-push`); ⭐ מועדפות עוברות לשרת ומסננות את הפושים אוטומטית
- 🗣️ **TTS הכרזה קולית** — הקראת "צבע אדום ב..." בעברית/אנגלית/ערבית/רוסית
- 📢 **לולאת צופר** — סירנה ישראלית (400-900Hz) בזמן אזעקה פעילה
- 🌙 **מצב שקט (DND)** — ללא צליל בין 23:00-07:00
- ⭐ **ערים מועדפות** — Push רק על ערים שבחרת

### סטטיסטיקה
- 📊 **ציר זמן 24 שעות** — גרף Canvas בזמן אמת
- 📈 **השוואה היסטורית** — היום vs אתמול vs ממוצע שבועי (IndexedDB)
- 📥 **ייצוא CSV/JSON** — עם BOM לעברית ב-Excel

### נגישות ורב-לשוניות
- 🌐 **4 שפות** — עברית, ערבית, אנגלית, רוסית + RTL/LTR אוטומטי
- ♿ **ARIA** — roles, aria-live, sr-only, keyboard navigation
- 🔲 **ניגודיות גבוהה** — מצב high contrast לכבדי ראייה
- 🎬 **Reduced motion** — כיבוד `prefers-reduced-motion`
- 🌙 **Auto dark mode** — `prefers-color-scheme` + זיהוי שעת לילה

### מובייל ו-PWA
- 📱 **Bottom navigation** — סרגל ניווט תחתון למובייל עם bottom sheet
- 📲 **PWA** — ניתן להתקנה ממובייל ודסקטופ ("הוסף למסך הבית")
- 🔄 **Service Worker** — network-first + cache fallback
- 📵 **Offline** — זיהוי אוטומטי + טעינה מ-IndexedDB

### שרת ו-Operations
- ⚡ **SSE** — Server-Sent Events, fallback ל-polling
- 📦 **Gzip** — דחיסה אוטומטית לכל תוכן > 1KB
- 🛡️ **CSP + Security** — Content-Security-Policy, X-Frame-Options, rate limiting
- 🔄 **Fallback** — מעבר אוטומטי למקור גיבוי אחרי 5 כשלונות OREF
- 📡 **Health webhook** — POST לכל URL כשהמערכת degrade
- 🛡️ **Admin dashboard** — `/admin` עם 12 מטריקות בזמן אמת
- 📄 **File logging** — רוטציה 10MB × 5 קבצים
- 💾 **IndexedDB** — היסטוריה מקומית ששורדת רענון

---

## 📁 מבנה הפרויקט

```
israel-alert-map/
├── server.js           # שרת Node.js — proxy, SSE, API, PWA, admin
├── index.html          # קליינט — מפה, UI, כל הלוגיקה
├── package.json        # Metadata + npm scripts
├── Dockerfile          # Docker image + healthcheck
├── docker-compose.yml  # One-click deployment
├── telegram-bot.js     # בוט טלגרם (עצמאי)
├── test.js             # 25+ בדיקות אוטומטיות
├── README.md           # אתה פה
├── LICENSE             # MIT
└── .gitignore          # logs, secrets, node_modules
```

---

## 🔌 API Endpoints

| Endpoint | תיאור |
|---|---|
| `GET /` | דף ראשי (HTML) |
| `GET /api/alerts` | אזעקות פעילות |
| `GET /api/history?limit=200` | היסטוריה |
| `GET /api/stream` | SSE זמן אמת |
| `GET /api/stats` | סטטיסטיקות |
| `GET /api/health` | Health check |
| `GET /api/config` | קונפיג שזמין לקליינט (`shelters_url`, `web_push`) |
| `GET /api/spec` | OpenAPI 3.0.3 spec (YAML) |
| `GET /api/logs` | צפייה בלוג |
| `GET /api/v1/*` | Alias לכל endpoint תחת `/api/*` — מומלץ לאינטגרציות יציבות |
| `GET /api/oref/live` | Proxy ל-OREF |
| `GET /api/oref/history` | היסטוריה מ-OREF |
| `GET /api/push/vapid-key` | VAPID public key |
| `POST /api/push/subscribe` | הרשמה ל-Push |
| `POST /api/push/unsubscribe` | ביטול Push |
| `GET /admin` | Admin dashboard (basic auth) |
| `GET /api/admin/metrics` | מטריקות מפורטות (JSON) |
| `GET /metrics` | Prometheus exposition (basic auth) |
| `GET /manifest.json` | PWA manifest |
| `GET /sw.js` | Service Worker |
| `GET /icon.svg` / `/favicon.ico` | App icon |
| `GET /embed.js` | Embed widget loader |

---

## ⚙️ משתני סביבה

| משתנה | ברירת מחדל | תיאור |
|---|---|---|
| `PORT` | `3000` | פורט השרת |
| `ADMIN_USER` | `admin` | שם משתמש לאדמין |
| `ADMIN_PASS` | `admin123` | סיסמת אדמין |
| `FALLBACK_ALERT_URL` | (ריק) | URL חלופי לאזעקות (יחיד, legacy) |
| `FALLBACK_ALERT_URLS` | (ריק) | רשימת URLs מופרדת בפסיק — sequence של mirrors. אם הראשון נכשל 5 פעמים השרת מסתובב לבא בתור |
| `HEALTH_WEBHOOK` | (ריק) | URL ל-POST כשהמערכת degraded |
| `OREF_URL_OVERRIDE` | (ריק) | החלף את URL של פיקוד העורף (לטסטים בלבד) |
| `OREF_HIST_OVERRIDE` | (ריק) | החלף את URL של ההיסטוריה (לטסטים בלבד) |
| `SHELTERS_URL` | (ריק) | URL חיצוני ל-JSON של מקלטים. הקליינט מאחה אם זמין; אחרת fallback ל-12 דגימות מובנות |
| `TELEGRAM_TOKEN` | (ריק) | Bot token לטלגרם |
| `TELEGRAM_CHANNEL` | (ריק) | Channel ID לטלגרם |

### פורמט `SHELTERS_URL`

JSON עם מערך אובייקטים: `[{lat: number, lng: number, n: string}, ...]`. `n` הוא שם המקלט (יתחתך ל-120 תווים). מקסימום 5000 פריטים. ה-API נקרא פעם אחת בטעינת הקליינט וזמין דרך `GET /api/config`. דוגמה:

```json
[
  {"lat": 32.0850, "lng": 34.7820, "n": "מקלט דיזנגוף 99"},
  {"lat": 31.7683, "lng": 35.2137, "n": "מקלט יפו 25"}
]
```

---

## 🔗 חיבור ל-OREF

המערכת מתחברת ל-API הפתוח של פיקוד העורף — **ללא צורך ב-signup או מפתחות**:

- **Endpoint:** `https://www.oref.org.il/WarningMessages/alert/alerts.json`
- **Polling:** כל 2 שניות
- **Headers נדרשים:** Accept-Language: he, X-Requested-With: XMLHttpRequest, Referer
- **קטגוריות:** cat=1 רקטות, cat=2 כטב"מ, cat=3 רעידת אדמה, cat=6 צונאמי

---

## 🐳 Docker

```bash
# Build & Run
docker-compose up -d

# עם משתני סביבה
ADMIN_PASS=mypass HEALTH_WEBHOOK=https://hooks.slack.com/xxx docker-compose up -d

# Logs
docker-compose logs -f
```

---

## ☁️ פריסה ל-Fly.io (חינמי, אוטומטי מ-GitHub)

הריפו כולל [fly.toml](fly.toml) ו-[.github/workflows/deploy.yml](.github/workflows/deploy.yml) — כל `git push` ל-`main` יפרוס אוטומטית.

### setup חד-פעמי (3 דקות)

```bash
# 1. התקנת CLI + יצירת חשבון (חינמי, אישור באמצעות כרטיס בלי חיוב)
curl -L https://fly.io/install.sh | sh     # macOS/Linux
# או: iwr https://fly.io/install.ps1 -useb | iex   # Windows PowerShell
flyctl auth signup

# 2. יצירת האפליקציה ב-Fly (השם חייב להיות גלובלית-ייחודי; ערוך את fly.toml בהתאם)
flyctl apps create red-alert        # → https://red-alert.fly.dev

# 3. הגדרת secrets (לא ב-fly.toml — אלה מוצפנים)
flyctl secrets set ADMIN_PASS="$(openssl rand -hex 16)"
flyctl secrets set FALLBACK_ALERT_URLS=""    # אופציונלי
flyctl secrets set HEALTH_WEBHOOK=""         # אופציונלי (Slack/Discord)

# 4. יצירת deploy token לשימוש ב-GitHub Actions
flyctl tokens create deploy -x 99999h
# העתק את הפלט.

# 5. ב-GitHub: Settings → Secrets and variables → Actions → New repository secret
#    Name:  FLY_API_TOKEN
#    Value: <ה-token מצעד 4>

# 6. דחיפה ראשונה
git push origin main
```

ה-workflow ירוץ ב-Actions tab, יבנה Docker image מ-`Dockerfile`, ידחוף ל-Fly, ויאמת `/api/health`. URL: `https://red-alert.fly.dev`.

### למה Fly ולא Render/Railway/Heroku?

- **SSE עובד מעולה** — חיבורים ארוכים, לא נחתכים
- **`auto_stop_machines = false`** — ה-VM לא נרדם → אזעקות בזמן אמת
- **HTTPS אוטומטי** — Web Push דורש זאת
- **Frankfurt region** — ~80ms לישראל
- **Free tier**: 3 VMs קטנים + 160GB egress/חודש (מספיק לטרפיק רגיל)

### post-deploy hardening

```bash
# הגדל זיכרון לעומסים גדולים (default 256MB מספיק עד ~500 SSE clients):
flyctl scale memory 512

# פרוס בכמה regions:
flyctl regions add waw ams        # Warsaw + Amsterdam
flyctl scale count 2 --region fra # 2 VMs ב-Frankfurt

# מעקב בזמן אמת:
flyctl logs                       # streaming logs
flyctl status                     # מצב VMs + checks
flyctl dashboard                  # פותח את ה-UI ב-Fly
```

### Persistent volume (אופציונלי) — שמירת VAPID keys בין deploys

ללא volume, בכל deploy ה-VAPID keys נוצרים מחדש → push subscribers ישנים מתנתקים בשקט. לפרודקשן מומלץ:

```bash
flyctl volumes create alertmap_data --region fra --size 1
# ערוך fly.toml — בטל הערה ב-[mounts] בלוק
# עדכן server.js שיכתוב VAPID + push-subs ל-/app/data
```

---

## 🔒 HTTPS (נדרש ל-Web Push)

הדפדפן **לא מאפשר Web Push ב-HTTP** (חוץ מ-`localhost`). לפריסה ציבורית — שים reverse proxy מול השרת ב-`:3000`.

### אופציה 1 — Caddy (קל ביותר, HTTPS אוטומטי)

`Caddyfile`:
```
alertmap.example.com {
  reverse_proxy localhost:3000 {
    flush_interval -1   # חיוני ל-SSE: מבטל בוצרינג של תגובות
  }
}
```

```bash
caddy run --config Caddyfile
```

### אופציה 2 — nginx + certbot

`/etc/nginx/sites-enabled/alertmap`:
```nginx
server {
  listen 443 ssl http2;
  server_name alertmap.example.com;
  ssl_certificate /etc/letsencrypt/live/alertmap.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/alertmap.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;            # חיוני ל-SSE
    proxy_read_timeout 24h;         # SSE לא מתנתק
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

```bash
sudo certbot --nginx -d alertmap.example.com
```

### אופציה 3 — Cloudflare Tunnel (ללא פתיחת פורט)

```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 🤖 Telegram Bot

```bash
npm install node-telegram-bot-api
TELEGRAM_TOKEN=123:ABC TELEGRAM_CHANNEL=@my_channel node telegram-bot.js
```

---

## 🧪 בדיקות + CI

```bash
node test.js                # node:test runner — 37 unit tests
node test-integration.js    # end-to-end: mock OREF → server → SSE (12 assertions)
npm run test:all            # שניהם
npm run lint                # ESLint (אופציונלי, npm i -D eslint)
```

CI ב-[.github/workflows/test.yml](.github/workflows/test.yml) — מריץ unit + integration על Node 18/20/22 (Ubuntu) + Node 20 (Windows + macOS). Dependabot ב-[.github/dependabot.yml](.github/dependabot.yml) — שבועי ל-npm, חודשי ל-GitHub Actions ול-Docker.

`test.js` משתמש ב-`node:test` המובנה (Node 18+) ובודק פונקציות פניניות (escapeHtml, formatShelter, shelterClass, distanceKm, isDND, fuzzyMatch). `test-integration.js` מקים שרת mock של OREF, מצביע אליו דרך `OREF_URL_OVERRIDE`, ובודק שאזעקה זורמת ל-`/api/alerts`, ל-SSE, ול-`/api/health` (12 assertions).

קונפיג ESLint ב-[.eslintrc.json](.eslintrc.json) — מינימלי, מתמקד בחיפוש באגים אמיתיים (`no-unused-vars`, `no-undef`, `no-redeclare`, `eqeqeq`); לא אכפתי לסגנון בכוונה כי הקוד דחוס במכוון.

---

## 📊 Prometheus / Observability

`GET /metrics` (admin-authed, פורמט exposition 0.0.4) — מתאים לסקרייפר Prometheus. מציין:
- `alertmap_uptime_seconds`, `alertmap_memory_rss_bytes`, `alertmap_memory_heap_used_bytes`
- `alertmap_requests_total`, `alertmap_alerts_total`
- `alertmap_oref_polls_total`, `alertmap_oref_errors_total`, `alertmap_oref_latency_ms`
- `alertmap_active_alerts`, `alertmap_sse_clients`
- `alertmap_push_subscribers`, `alertmap_push_sent_total`, `alertmap_push_errors_total`
- `alertmap_fallback_active`

```yaml
# prometheus.yml
scrape_configs:
  - job_name: alertmap
    metrics_path: /metrics
    basic_auth: { username: admin, password: 'changeme' }
    static_configs: [{ targets: ['alertmap.internal:3000'] }]
```

---

## 🌐 Embed widget

הטמעה באתר חיצוני בשורה אחת:

```html
<script src="https://your-alertmap.example.com/embed.js"
        data-lang="he"
        data-city="חיפה"
        data-theme="dark"
        data-width="450px"
        data-height="350px"></script>
```

הסקריפט מזריק `<iframe>` עם `?embed=1` — מצב מינימלי ללא header/sidebar/mobile nav, מפה מלאה. הקליינט מזהה את הדגל ב-URL ומחיל מחלקת `html.embed`.

---

## 🔗 Shareable URLs

המצב מסונכרן ל-URL בזמן אמת ב-`history.replaceState`. ניתן להעתיק את הקישור הנוכחי לשיתוף:

| פרמטר | דוגמה | פעולה |
|---|---|---|
| `?lang=` | `?lang=en` | שפה (he/en/ar/ru) |
| `?theme=` | `?theme=light` | ערכת נושא |
| `?city=` | `?city=שדרות` | flyTo לעיר בטעינה |
| `?embed=1` | `?embed=1` | מצב iframe מצומצם |

כפתור 🔗 בטאב "אודות" משתמש ב-`navigator.share` או clipboard.

---

## 📜 רישיון

[MIT](LICENSE) — שימוש חופשי.

---

<div align="center">

**נתונים: [פיקוד העורף](https://www.oref.org.il/) | מפה: [Leaflet](https://leafletjs.com/) + [CARTO](https://carto.com/)**

⚠️ פעל תמיד לפי הנחיות גורמי הביטחון הרשמיים

</div>

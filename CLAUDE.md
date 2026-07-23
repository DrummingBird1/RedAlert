# CLAUDE.md

מדריך עבודה בפרויקט עבור Claude Code. הקובץ נטען אוטומטית כשנפתח השיח בתיקייה הזו.

## מה הפרויקט

**צפיר** (Tzafir; חבילת npm: `tzafir`, לשעבר `israel-alert-map`, v3.3.0) — שרת Node.js + קליינט HTML עצמאי שמציג בזמן אמת את אזעקות פיקוד העורף על מפת Leaflet. תלות בליבה: אפס (רק `node` ≥ 18). תלויות אופציונליות: `web-push`, `node-telegram-bot-api`. שם ה-repo ב-GitHub נשאר `RedAlert` במכוון (המיתוג שונה, ה-repo לא שונה).

מקור הנתונים: `https://www.oref.org.il/WarningMessages/alert/alerts.json` (polling כל 2 שניות). אין מפתחות, אין הרשמה.

## מבנה הקבצים

הפרויקט שטוח לחלוטין (אין `src/`, אין תיקיות משנה לקוד):

| קובץ | תפקיד |
|---|---|
| [server.js](server.js) | שרת HTTP יחיד — proxy ל-OREF, SSE, API, PWA assets, admin dashboard, Web Push, fallback, health webhook, store snapshot. **בנוי כקובץ אחד עם שורות צפופות מאוד** (one-liners מכוונים). |
| [index.html](index.html) | קליינט מונוליטי — HTML + CSS + JS באותו קובץ. כל המפה, ה-UI, IndexedDB, audio, TTS. **טוען את [lib.js](lib.js) באופן סינכרוני** (`<script src="/lib.js">`) לפני הסקריפט הפנימי. |
| [lib.js](lib.js) | **מקור-אמת יחיד** ל-data סטטי (`CITIES`, `LN`, `TM`, `RS`, `SHELTERS_DEFAULT`) ופונקציות פניניות (`escapeHtml`, `formatShelter`, `shelterClass`, `distanceKm`, `isDND`, `normalizeCity`, `fuzzyMatch`). UMD — עובד גם כ-`<script>` בדפדפן (גלובל `AlertLib`) וגם כ-`require('./lib.js')` ב-Node. הקליינט עוטף בשמות קצרים (`X`, `C`, `findC`...), הטסטים מייבאים ישירות. |
| [test.js](test.js) | בדיקות יחידה ל-`lib.js` דרך `node:test`. ללא תלויות. |
| [test-integration.js](test-integration.js) | E2E — מקים mock OREF + spawned server, מאמת אזעקה זורמת ל-`/api/alerts` + SSE + `/api/health`. |
| [telegram-bot.js](telegram-bot.js) | בוט עצמאי — polling ל-`/api/alerts` ושליחה לערוץ טלגרם. |
| [Dockerfile](Dockerfile) + [docker-compose.yml](docker-compose.yml) | בנייה ל-`node:20-alpine` עם healthcheck. |
| [package.json](package.json) | scripts בלבד; ללא `dependencies` רגילים, רק `optionalDependencies`. |

קבצי runtime שנוצרים אוטומטית (ב-`.gitignore`):
- `logs/alerts.log` — לוג אזעקות עם רוטציה (10MB × 5 קבצים)
- `.vapid-keys.json` — מפתחות VAPID ל-Web Push (נוצרים בהפעלה ראשונה)
- `.push-subs.json` — הרשמות Push
- `.store-snapshot.json` — snapshot של היסטוריית האזעקות; נטען בהפעלה (כ-history בלבד, לא active) כדי לשרוד restart/redeploy

## פקודות הפעלה

```bash
node server.js              # מפעיל את השרת על פורט 3000
node test.js                # 44+ בדיקות (כולל smoke test לשרת)
node test-integration.js    # E2E — mock OREF → server → SSE
node telegram-bot.js        # בוט טלגרם (דורש משתני סביבה)
npm install                 # התקנת web-push + telegram-bot-api (אופציונלי)
docker-compose up -d        # פריסה ב-Docker

npm start                   # = node server.js
npm test                    # = node test.js
npm run test:integration    # = node test-integration.js
npm run test:all            # הריצה של שניהם ברצף
npm run telegram            # = node telegram-bot.js
npm run docker:build        # docker build -t alertmap .
npm run docker:run          # docker run -p 3000:3000 ...
```

אין `npm run lint`, `npm run typecheck`, `npm run format` — הפרויקט ללא toolchain.

## משתני סביבה

| משתנה | ברירת מחדל | הערה |
|---|---|---|
| `PORT` | `3000` | פורט השרת |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / *(אקראי)* | אם `ADMIN_PASS` לא מוגדרת — מוגרלת בהפעלה ומודפסת ללוג פעם אחת (משתנה בכל restart עד הגדרת ערך קבוע). |
| `FALLBACK_ALERT_URL` | (ריק) | URL חלופי שמופעל אחרי 5 כשלונות OREF |
| `HEALTH_WEBHOOK` | (ריק) | URL ל-POST כשהשרת degraded/recovered |
| `DISCORD_WEBHOOK_URL` | (ריק) | Webhook של ערוץ Discord (Channel Settings → Integrations → Webhooks) — שולח embed לכל batch אזעקות אמיתי חדש מ-`pollAlerts()`. אין SDK, POST רגיל דרך `https`. |
| `TELEGRAM_TOKEN` / `TELEGRAM_CHANNEL` | (ריק) | לבוט בלבד |
| `OREF_URL_OVERRIDE` / `OREF_HIST_OVERRIDE` | (ריק) | החלף את URL של OREF (לטסטים בלבד; `test-integration.js` משתמש בזה) |
| `SHELTERS_URL` | (ריק) | JSON חיצוני של מקלטים אמיתיים (`[{lat,lng,n}]`); הקליינט מחליף את ~34 הדוגמאות ה-illustrative אם נמצא. **אין מאגר CKAN פתוח של מקלטים ב-data.gov.il** (נבדק — 0 תוצאות); ה-default הוא נקודות מרכז-עיר גסות ומסומנות "לדוגמה", לא כתובות מאומתות |

## ארכיטקטורה — נקודות חיוניות

### שרת ([server.js](server.js))

- **Polling יחיד**: `setInterval(pollAlerts, 2000)` מושך את OREF, מחשב hash, מוסיף לרשימה גלובלית (`store`, max 5000), משדר לכל לקוחות ה-SSE. אזעקות מוגדרות "active" למשך 90 שניות ואז מוחלפות ל-history.
- **SSE** ב-`/api/stream`: שולח init אז update בכל שינוי, heartbeat כל 2s.
- **דדופליקציה**: `lastHash` נמחק אחרי 30 שניות — אזעקה זהה תוך חצי דקה נחשבת חוזרת.
- **Fallback**: אחרי 5 כשלונות רצופים, עובר ל-`FALLBACK_ALERT_URL`. בודק חזרה ל-OREF כל 60s.
- **Web Push**: רק אם `web-push` הותקן. VAPID keys נשמרים ב-`.vapid-keys.json` ונוצרים אוטומטית. הקליינט נרשם דרך `wpSub()` ושולח `subscription`+`favs`+`dnd` ל-`/api/push/subscribe`; השרת מסנן פושים לפי עיר מועדפת ושולח `silent` בשעות שקט.
- **Rate limit**: 120 בקשות לדקה לכל IP. בקליפינג ב-`setInterval` כל 5 דקות.
- **Gzip**: רק לתוכן > 1KB ו-MIME types מסוימים.
- **HTML cache**: `getHtml()` קורא את `index.html` ושומר במזיכרון לפי mtime — שינוי בקובץ נתפס בלי restart.
- **Admin dashboard**: `/admin` עם Basic auth, פולל את `/api/admin/metrics` כל 5s.
- **Security headers**: רק לתגובת HTML. JSON endpoints לא מקבלים `X-Content-Type-Options` וכו'.

### קליינט ([index.html](index.html))

- **קוד JS דחוס ידנית**: שמות משתנים בני אות אחת, פונקציות בני 2-3 אותיות (`X`=escape, `t`=translate, `C`=cities, `TM`=type map, `RS`=region shelter, `SHL`=shelters list). זה לא מינופיקציה אוטומטית — לעריכה צריך לקרוא כל שורה בעיון.
- **State גלובלי**: `hist`, `act` (Map), `mrk` (Map), `known` (Set), `favs`, `flt`, `theme` וכו' — אין framework.
- **Persistence**:
  - `localStorage`: lang, theme, favs, dnd, tts, siren, hc, cls, push.
  - `IndexedDB` (`alertmap` v1, store `alerts`): היסטוריה ארוכת טווח להשוואות (today/yesterday/weekAvg).
- **SSE + fallback polling**: `connectSSE()` + `startPoll()` רץ כל 5s רק אם `sseOK=false`.
- **Cities (`C`)**: dict סטטי של ~55 ערים עם lat/lng, region, shelter time (לא 130+ כמו ב-README).
- **Fuzzy matching (`findC`)**: exact → normalized → substring → word-by-word. תומך ב-"תל אביב - יפו" → "תל אביב".
- **i18n (`LN`)**: 14 שפות — he/en/ar/ru + am (אמהרית) / ti (תיגרינית) / th (תאילנדית) / tl (טאגלוג) / uk (אוקראינית) / fr / es / ro / hi / zh. `t(key)` עם fallback ל-Hebrew; לכל השפות אותו סט מפתחות (נבדק ע״י test.js). התרגומים ל-am/ti הם best-effort (שפות low-resource) — מומלץ אימות ע״י דובר native לפני הסתמכות תפעולית. `<select id="langS">` נבנה דינמית ב-JS מ-`AlertLib.LANG_META` (אין יותר עריכת `<option>` ידנית ב-index.html). TTS משתמש בקידומת `ttsPrefix` המתורגמת ובלוקאל מ-`AlertLib.TTS_LOCALE[lang]`. `speak(cities)` מקבל מערך ומדבר קריאה אחת לכל batch — קריאה בלולאה לכל עיר בנפרד תבטל (`speechSynthesis.cancel()`) את הקודמת לפני שנשמעה.
- **תפריטים/טאבים**: `alerts` (ברירת מחדל, כולל שורת חיפוש-עיר וסינון) / `stats` / `history` (חדש — טוען את **כל** ההיסטוריה מ-IndexedDB דרך `gDB()`, לא רק את ה-500 שב-`hist` בזיכרון; טווח תאריכים + חיפוש עצמאיים) / `updates` (חדש — מציג את מערך `CHANGES` הסטטי, מראה גם פופאפ "מה חדש" חד-פעמי דרך `checkWhatsNew()` שמשווה `APP_VERSION` ל-`localStorage['alertmap-lastver']`) / `about`. דסקטופ: `.stabs`/`swTab()`. מובייל: `.mn-i`/`mobTab()` (מעתיק את `#sbC` ל-`#mSheet`; טאבים אסינכרוניים כמו history מוחזרים כ-Promise כדי שההעתקה תחכה לרינדור). כפתור תרומת Patreon (`donateMini()`) מופיע בכל טאב חוץ מ-About (ששם יש את `donateCard()` המלא) + בתחתית מודל ההגדרות.
- **מפה**: Leaflet + CartoDB light/dark (ברירת מחדל) או שכבת לוויין חינמית — Esri World Imagery (`server.arcgisonline.com`, ללא מפתח API) דרך כפתור 🛰️ ב-`.mc` (`tglSat()`). דורש allowlist גם ב-CSP `img-src` (`secHeaders()`) וגם בבדיקת ה-hostname בקאש האריחים של ה-SW.
- **PWA**: SW מקודד בתוך `server.js` (משתנה `SW`), מטמון `red-alert-v10` + מטמון אריחים נפרד `red-alert-tiles-v1` (Leaflet basemap כולל לוויין, cache-first). שינוי ל-SW דורש bump של `CN` ב-server.js.

## איך להוסיף תכונה / לשנות קוד

1. **שינויים בלוגיקת השרת** — `server.js` ערוך ישירות. אין hot reload — `node server.js` מחדש.
2. **שינויים בקליינט** — `index.html` ערוך ישירות. השרת מזהה את שינוי ה-mtime ומגיש את הגרסה החדשה (refresh בדפדפן). זכור ש-Service Worker עלול להגיש cached גרסה — חשוב ל-bump את `CN` (כרגע `red-alert-v10`) ב-`server.js` (משתנה `SW`) כדי להפעיל invalidate, או לפתוח DevTools → Application → Service Workers → Unregister.
3. **הוספת עיר** — ערוך את `CITIES` ב-[lib.js](lib.js). פורמט: `"שם":{lat:X,lng:Y,r:"אזור",s:זמן_מיגון}`.
4. **הוספת שפה** — הוסף ערך ל-`LN`, ל-`LANG_META` (שם native + דגל) ול-`TTS_LOCALE` (קוד BCP-47) ב-[lib.js](lib.js) — כולל **כל** המפתחות שקיימים ב-`LN.en` (test.js/הקוד לא בודקים זאת אוטומטית, אבל חוסר מפתח נופל חזרה ל-Hebrew בשקט). `<select id="langS">` ב-index.html נבנה אוטומטית מ-`LANG_META` דרך `initLangSelect()` — אין לערוך אותו ידנית.
5. **endpoint חדש** — הוסף `if (p === '/api/...')` ב-`server.js` ל-pipeline הקיים בתוך `http.createServer`. תזכור `track(p, code)` ו-`gz(req, res, body, ct)`.
6. **בדיקות** — הפונקציות הפניניות חיות ב-[lib.js](lib.js) (מקור-אמת יחיד). הקליינט עוטף בשמות קצרים, ו-`test.js` מייבא `require('./lib.js')`. **אם משנים לוגיקה פנינית — עורכים את `lib.js`, וזהו.** אין יותר שכפול ידני.
7. **הוספת data סטטי** (עיר/שפה/סוג אזעקה) — עורכים את האובייקטים ב-[lib.js](lib.js) (`CITIES`/`LN`/`TM`/`RS`). הקליינט מושך אותם דרך `AlertLib`. עיר ללא קואורדינטה (לא נמצאה ב-`fuzzyMatch`) מסומנת `noLoc:true` — **לא מוצב מרקר במיקום אקראי** (היא מופיעה ברשימה עם תווית "מיקום לא ידוע" בלבד).

## מוסכמות סגנון

- **שפה**: הערות וטקסט UI בעברית. שמות משתנים/פונקציות באנגלית.
- **דחיסה**: הפרויקט מעדיף one-liners ארוכים על קוד מרווח. כשעורכים אזור קיים — שמרו על הסגנון; אזורים חדשים יכולים להיות נשימים יותר.
- **ללא תלויות**: כל פיצ'ר חדש בשרת אמור לעבוד גם כש-`web-push` לא מותקן. ההתקנה היא אופציונלית בכוונה.
- **אין framework בקליינט**: לא להוסיף React/Vue. השתמש ב-DOM API.
- **אבטחה**: כל מחרוזת מהמשתמש/OREF שמוצגת ב-HTML חייבת לעבור `X()` (escape).

## URL state (sharable links)

הקליינט קורא וכותב את ה-URL דרך `history.replaceState`. סטייט שמתסנכרן:

| param | טיפול בטעינה | סנכרון לאחור |
|---|---|---|
| `?lang=he\|en\|ar\|ru` | dorsרבים `lang`, override של localStorage | `setLang()` |
| `?theme=light\|dark` | override של auto-dark + localStorage | `applyTh()` |
| `?city=שדרות` | flyTo אחרי `initMap` (לא נשמר ב-URL) | — |
| `?embed=1` | `document.documentElement.classList.add('embed')` — מסתיר כל ה-chrome | — |

`syncURL()` מנקה פרמטרים שזהים לברירת המחדל (he, dark) כדי שה-URL ישאר קצר.

## Embed widget

`/embed.js` מוגש כסקריפט loader. אתרים זרים מטמיעים עם `<script src=".../embed.js" data-city="...">` והוא מזריק iframe ל-`/?embed=1&...`. `X-Frame-Options: DENY` ו-CSP `frame-ancestors 'self'` מתבטלים רק כאשר ה-URL מכיל `embed=1` (`secHeaders(res, true, isEmbed)`).

## Prometheus

`/metrics` — basic auth, פורמט 0.0.4. כל מטריקה משויכת ל-`alertmap_*` namespace. מטריקות gauge מציגות מצב נוכחי, counters לא יורדים לעולם. ראה [server.js](server.js) `prometheusMetrics()` לרשימה מלאה.

## קיצורי מקלדת בקליינט

| מקש | פעולה |
|---|---|
| `Space` | השתק/הפעל צליל |
| `S` | סירנה (toggle) |
| `H` | מבט בית של המפה |
| `M` | המיקום שלי |
| `L` | מעבר ערכת נושא |
| `Esc` | סגירת modal פתוח |
| `?` | toast עם רשימת הקיצורים |

קיצורים מבוטלים כאשר ה-focus על `input/textarea/select`/contenteditable, או על `<button>` (כדי לאפשר ל-Space/Enter להפעיל את הכפתור), או כאשר modal פתוח (חוץ מ-ESC שתמיד סוגר).

## בדיקות

| קובץ | סוג | runner |
|---|---|---|
| [test.js](test.js) | unit (פונקציות פניניות) | `node:test` המובנה |
| [test-integration.js](test-integration.js) | E2E (mock OREF → SSE) | ידני, ללא runner |

`test.js` מייבא את הפונקציות מ-[lib.js](lib.js) ישירות (`require('./lib.js')`) — אותו קובץ שהקליינט טוען. אין יותר שכפול: עריכה ב-`lib.js` משפיעה גם על הקליינט וגם על הטסטים. `shelterClass` ב-lib מחזיר `immediate/fast/medium/slow`; הקליינט ממפה ל-CSS suffix קצר (`imm/fast/med/slow`) דרך `SHC_MAP`. `formatShelter(s, labels)` מקבל את מחרוזות התרגום כפרמטר (הקליינט מעביר `t(...)`, הטסטים מעבירים עברית).

## API versioning

כל endpoint תחת `/api/X` זמין גם תחת `/api/v1/X` עם תוצאה זהה. ה-aliasing נעשה ע״י strip של `/v1/` בתחילת ה-pathname לפני המעבר על הטבלת ה-endpoints. שינוי breaking בעתיד יוכל להיכנס תחת `/api/v2/`.

## OpenAPI

[openapi.yaml](openapi.yaml) — spec של כל ה-endpoints. נחשף דרך `GET /api/spec` (וגם `/openapi.yaml`). העלה ל-Swagger UI / Postman / Insomnia.

## Severity profiles בקליינט

כל סוג אזעקה (`rockets`/`uav`/`earthquake`/`tsunami`) משויך לפרופיל ב-`ALERT_PROFILES` עם:
- תדרי `playSnd` שונים (רקטות 880-660Hz מהיר, רעידת אדמה 400Hz איטי)
- vibration pattern שונה
- מהירות pulse שונה ב-CSS (`.cm.t-rockets`/`.cm.t-uav`/וכו׳)

הוספת סוג חדש דורשת עדכון של 3 מקומות: `TM` (icon/color), `ALERT_PROFILES` (sound/vibe), ו-CSS (`.cm.t-X`).

## דיברגים נפוצים

- **השרת מציג "OREF back" אבל אין אזעקות** — תקין; משמעו שהמערכת עברה ל-fallback וחזרה.
- **בדיקת `node test.js` כושלת על `health fetch error`** — הפורט תפוס, או `server.js` לא קיים. הבדיקה משתמשת בפורט 3001-4000 רנדומלי.
- **PWA לא מתעדכן** — DevTools → Application → Service Workers → Unregister, או bump של `CN` ב-`SW` בתוך server.js.
- **אזעקות כפולות** — הדפדפן פתוח ב-2 טאבים; כל אחד מקבל SSE עצמאי. תקין.

## אזהרות בטיחות

- **סיסמת אדמין** — אם `ADMIN_PASS` לא מוגדרת, מוגרלת אקראית בהפעלה (מודפסת ללוג פעם אחת). הגדר ערך קבוע ל-production.
- **CORS פתוח (`*`)** — מכוון; ה-API נועד לצריכה ציבורית.
- **CSP מתיר `unsafe-inline`** — מכוון; הקליינט הוא HTML+JS מונוליטי.
- **המערכת אינה חליפה להנחיות פיקוד העורף**. הדגש את זה בכל UI חדש.

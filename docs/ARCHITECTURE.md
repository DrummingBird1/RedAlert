# ARCHITECTURE.md — עומק טכני (לקריאה לפי צורך)

הוצא מ-[AGENTS.md](../AGENTS.md) כדי לחסוך טוקנים בכל סשן. **קרא רק את הסעיף הרלוונטי למשימה** — למציאת סעיף: `grep -n "^## \|^### \|^- \*\*" docs/ARCHITECTURE.md`.
כללי הברזל והאילוצים הקריטיים נמצאים ב-[AGENTS.md](../AGENTS.md). מצב נוכחי ומשימות פתוחות: [HANDOFF.md](HANDOFF.md).

## משתני סביבה

| משתנה | ברירת מחדל | הערה |
|---|---|---|
| `PORT` | `3000` | פורט השרת |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / *(אקראי)* | אם `ADMIN_PASS` לא מוגדרת — מוגרלת בהפעלה ומודפסת ללוג פעם אחת (משתנה בכל restart עד הגדרת ערך קבוע). |
| `ADMIN_TOTP_SECRET` | (ריק) | סוד TOTP (base32) — כשמוגדר, הפעלת 2FA על `/admin`+`/metrics`: סיסמת ה-Basic Auth הופכת ל-`ADMIN_PASS` + קוד בן 6 ספרות מאפליקציית authenticator. ה-URI ל-QR מודפס ללוג בהפעלה. ללא תלות npm — `crypto` HMAC-SHA1 מובנה. |
| `FALLBACK_ALERT_URL` | (ריק) | URL חלופי שמופעל אחרי 5 כשלונות OREF |
| `HEALTH_WEBHOOK` | (ריק) | URL ל-POST כשהשרת degraded/recovered |
| `DISCORD_WEBHOOK_URL` | (ריק) | Webhook של ערוץ Discord (Channel Settings → Integrations → Webhooks) — שולח embed לכל batch אזעקות אמיתי חדש מ-`pollAlerts()`. אין SDK, POST רגיל דרך `https`. |
| `TELEGRAM_TOKEN` / `TELEGRAM_CHANNEL` | (ריק) | לבוט בלבד |
| `OREF_URL_OVERRIDE` / `OREF_HIST_OVERRIDE` | (ריק) | החלף את URL של OREF (לטסטים בלבד; `test/integration.js` ו-`test/e2e.js` משתמשים בזה) |
| `DATA_DIR` | תיקיית הריפו | היכן נכתבים קבצי ה-runtime: `logs/`, `.store-snapshot.json`, `.vapid-keys.json`, `.push-subs.json`. **כל טסט שמרים `server.js` חייב להעביר תיקייה זמנית** — אחרת הוא כותב אזעקות מדומות להיסטוריה/ללוגים האמיתיים של המפתח (`node server.js` הבא היה טוען אותן כהיסטוריה). |
| `RATE_LIMIT_PER_MIN` | `120` | מגבלת בקשות לדקה לכל IP. ה-override קיים בשביל `test/e2e.js` בלבד — דפדפן אחד = IP אחד, וסוויטה מלאה של טעינות עמוד חורגת מ-120 לדקה (ה-`GET /` עצמו קיבל 429 וגרם לכשלונות אקראיים של טסטים). |
| `SHELTERS_URL` | (ריק) | JSON חיצוני של מקלטים אמיתיים (`[{lat,lng,n}]`); הקליינט מחליף את ~35 הדוגמאות ה-illustrative אם נמצא. **אין מאגר CKAN פתוח של מקלטים ב-data.gov.il** (נבדק — 0 תוצאות); ה-default הוא נקודות מרכז-עיר גסות ומסומנות "לדוגמה", לא כתובות מאומתות. **חריגים: תל אביב-יפו, ירושלים, חיפה** — כשלא מוגדר `SHELTERS_URL`, הקליינט שולף אוטומטית נתונים אמיתיים משכבות ה-GIS העירוניות הפתוחות של שלוש הערים (`GET /api/shelters/{tel-aviv,jerusalem,haifa}`, כל אחת proxy מטומן בשרת עם TTL 24h — ראה `makeShelterFetcher()`/`getTelAvivShelters()`/`getJerusalemShelters()`/`getHaifaShelters()` ב-server.js) ומחליף איתם את הדוגמאות הכלליות של אותן ערים; `loadExternalShelters()` ב-index.html מנקה גם כפילויות קואורדינטה מדויקת (חלק מהמקורות העירוניים חוזרים על אותו מבנה פעמיים). שאר הערים נשארות illustrative — **באר שבע** יש לה רישום אמיתי ב-ArcGIS Hub (`gis-beer-sheva.opendata.arcgis.com`, ~81 רשומות) אך ה-endpoint בפועל (`opendatagis.br7.org.il`) לא נענה מכאן (כנראה חסום מחוץ לישראל) ולכן לא חובר; **ראשון לציון**/**פתח תקווה** נבדקו ואין להן שכבת GIS פתוחה למקלטים (רק PDF סטטי) |


## ארכיטקטורה — נקודות חיוניות

### שרת ([server.js](../server.js))

- **Polling יחיד**: `setInterval(pollAlerts, 2000)` מושך את OREF, מחשב hash, מוסיף לרשימה גלובלית (`store`, max 5000), משדר לכל לקוחות ה-SSE. אזעקות מוגדרות "active" למשך 90 שניות ואז מוחלפות ל-history.
- **SSE** ב-`/api/stream`: שולח init אז update בכל שינוי, heartbeat כל 2s.
- **דדופליקציה**: `lastHash` נמחק אחרי 30 שניות — אזעקה זהה תוך חצי דקה נחשבת חוזרת.
- **Fallback**: אחרי 5 כשלונות רצופים, עובר ל-`FALLBACK_ALERT_URL`. בודק חזרה ל-OREF כל 60s.
- **Web Push**: רק אם `web-push` הותקן. VAPID keys נשמרים ב-`.vapid-keys.json` ונוצרים אוטומטית. הקליינט נרשם דרך `wpSub()` ושולח `subscription`+`favs`+`dnd` ל-`/api/push/subscribe`; השרת מסנן פושים לפי עיר מועדפת ושולח `silent` בשעות שקט.
- **בריאות הפיד (`upstreamOk()`)**: `/api/health` מחזיר `status:'degraded'` + `upstream_ok:false` כשהפיד מ-OREF לא עונה — ענה פעם: שתיקה >30s; אף פעם לא ענה: 3 כשלונות רצופים **או 30s מההפעלה** (ההחלטה היא `AlertLib.upstreamOk()` ב-lib.js — פונקציה טהורה עם זמנים מוזרקים). **הקריטריון של זמן-קיר הוא קריטי**: מארח שמקפיא טיימרים בין בקשות (Vercel) כמעט לא מריץ את לולאת הסקירה, אז ספירת הכשלונות לעולם לא מגיעה ל-3 גם אחרי דקות של uptime — v1.6.3 החליט לפי ספירה בלבד ודיווח `ok` באתר החי (`last_poll_ago:null`, uptime 100s). תמיד HTTP 200 (healthcheck של Docker/Fly תלוי בזה). הלקוח (`checkUpstream()`, כל 30s + בכל חיבור SSE) מציג את `#upBar` ואת מצב "אין חיבור למקור" בסרגל במקום "הכל שקט". **למה זה קיים**: פיקוד העורף (Akamai) חוסם IP שאינו ישראלי — האתר החי ב-Vercel (פרנקפורט/וושינגטון) קיבל "Access Denied" ולא הציג אף פעם אזעקה אמיתית, בעוד `/api/health` דיווח `ok` והלקוח "מחובר" + "הכל שקט". כל מארח חייב לרוץ מישראל או להגדיר `FALLBACK_ALERT_URL`.
- **Rate limit**: 120 בקשות לדקה לכל IP. בקליפינג ב-`setInterval` כל 5 דקות.
- **Gzip**: רק לתוכן > 1KB ו-MIME types מסוימים.
- *(אילוץ קריטי — הועבר ל-[AGENTS.md](../AGENTS.md#אילוצים-קריטיים--חובה-לפני-עריכה))*
- **HTML cache**: `getHtml()` קורא את `index.html` ושומר במזיכרון לפי mtime — שינוי בקובץ נתפס בלי restart.
- **Admin dashboard**: `/admin` עם Basic auth, פולל את `/api/admin/metrics` כל 5s.
- **Security headers**: רק לתגובת HTML. JSON endpoints לא מקבלים `X-Content-Type-Options` וכו'.

### קליינט ([index.html](../index.html))

- **קוד JS דחוס ידנית**: שמות משתנים בני אות אחת, פונקציות בני 2-3 אותיות (`X`=escape, `t`=translate, `C`=cities, `TM`=type map, `RS`=region shelter, `SHL`=shelters list). זה לא מינופיקציה אוטומטית — לעריכה צריך לקרוא כל שורה בעיון.
- **State גלובלי**: `hist`, `act` (Map), `mrk` (Map), `known` (Set), `favs`, `flt`, `theme` וכו' — אין framework.
- **Persistence**:
  - `localStorage`: lang, theme, favs, dnd, tts, siren, hc, cls, push.
  - `IndexedDB` (`alertmap` v1, store `alerts`): היסטוריה ארוכת טווח להשוואות (today/yesterday/weekAvg).
- **SSE + fallback polling**: `connectSSE()` + `startPoll()` רץ כל 5s רק אם `sseOK=false`.
- **Cities (`C`)**: dict סטטי של ~55 ערים עם lat/lng, region, shelter time (לא 130+ כמו ב-README).
- **Fuzzy matching (`findC`)**: exact → normalized → substring → word-by-word. תומך ב-"תל אביב - יפו" → "תל אביב".
- **i18n (`LN`)**: 14 שפות — he/en/ar/ru + am (אמהרית) / ti (תיגרינית) / th (תאילנדית) / tl (טאגלוג) / uk (אוקראינית) / fr / es / ro / hi / zh. `t(key)` עם fallback ל-Hebrew; לכל השפות אותו סט מפתחות + LANG_META + TTS_LOCALE (נבדק אוטומטית ב-test/unit.js, describe('i18n completeness')). כיוון RTL/LTR עובר דרך `AlertLib.isRTL(lang)` (he/ar בלבד RTL) — פנינה ב-lib.js, לא לוגיקה inline. ביקור ראשון ללא `?lang=`/localStorage שומר על ניחוש לפי `navigator.languages` (`detectBrowserLang()` → `AlertLib.detectLang()` ב-lib.js: מפצל על `-`/`_` ולא `slice(0,2)` — "fil-PH" נהיה "fi" ונפל לעברית; כינויים `fil→tl`, `iw→he`) לפני נפילה חזרה לעברית. ⚠️ **כיסוי התרגום חלקי**: מילון `LN` (41 מפתחות) מלא ב-14 שפות, אבל מחרוזות רבות בממשק עדיין קשיחות בעברית: הבאנר "היכנס למרחב מוגן עכשיו!" + הנחיית המיגון + "אני בסדר", המונים העליונים, כל טאב "אודות", כל חלון ההגדרות, תוויות הפילטרים וה-badge "מחובר/מנותק". אל תטען שהממשק "מתורגם ל-14 שפות" בלי לציין זאת. התרגומים ל-am/ti הם best-effort (שפות low-resource) — מומלץ אימות ע״י דובר native לפני הסתמכות תפעולית. `<select id="langS">` נבנה דינמית ב-JS מ-`AlertLib.LANG_META` (אין יותר עריכת `<option>` ידנית ב-index.html). TTS משתמש בקידומת `ttsPrefix` המתורגמת ובלוקאל מ-`AlertLib.TTS_LOCALE[lang]`. `speak(cities)` מקבל מערך ומדבר קריאה אחת לכל batch — קריאה בלולאה לכל עיר בנפרד תבטל (`speechSynthesis.cancel()`) את הקודמת לפני שנשמעה.
- **תפריטים/טאבים**: `alerts` (ברירת מחדל, כולל שורת חיפוש-עיר עם autocomplete מ-`<datalist id="cityList">` (מאוכלס פעם אחת ב-DOMContentLoaded מ-`citySelOptions()`), בורר "קפוץ ליישוב" (`citySelOptions()`/`jumpToCity()`) וסינון) / `stats` / `history` (טוען את **כל** ההיסטוריה מ-IndexedDB דרך `gDB()`, לא רק את ה-500 שב-`hist` בזיכרון; טווח תאריכים + חיפוש עצמאיים, גם עם `list="cityList"`, כולל replay — `▶ הפעל` טס את המפה כרונולוגית על פני `historyReplayList` שנבנה מחדש בכל render, `setInterval` בקצב קבוע, `stopReplay()` תמיד נקרא כשעוזבים את הטאב/משנים פילטר) / `updates` (מציג את מערך `CHANGES` הסטטי, מראה גם פופאפ "מה חדש" חד-פעמי דרך `checkWhatsNew()` שמשווה `APP_VERSION` ל-`localStorage['alertmap-lastver']`) / `about`. דסקטופ: `.stabs`/`swTab()` — כל `.stab` הוא `display:flex;flex-direction:column` (אייקון ב-`.si` למעלה, תווית מתורגמת `<span data-i18n>` למטה), **בנוסף** ל-`aria-label`+`title`. **⚠️ למה column ולא inline**: עד ל-v1.6.1 רק אזעקות הייתה עם טקסט גלוי (שאר הטאבים היו אייקון בלבד עם title בהובר); כשנוסף טקסט גלוי לכולם בפריסת inline רגילה, המילים הארוכות ("סטטיסטיקה") נשברו לשורה שנייה בעוד מילים קצרות ("אודות") נשארו בשורה אחת — גובה לא אחיד ומראה שבור. פריסת column עם `.si{font-size:13px}` נותנת את אותו גובה בדיוק לכל 5 הטאבים בלי תלות באורך המילה. יש טסט E2E ל-regression הזה. מובייל: `.mn-i`/`mobTab()` (מעתיק את `#sbC` ל-`#mSheet`; טאבים אסינכרוניים כמו history מוחזרים כ-Promise כדי שההעתקה תחכה לרינדור). **`.mn-i` חייב `width:100%` מפורש** — `.mn` הופך ל-`display:flex` במובייל, ולכן `.mn-i` (הילד שלו) הוא flex-item שמתכווץ ל-content-width בלי `width`/`flex` מפורש, מה שדוחס את כל 6 כפתורי הניווט התחתון לפינה אחת ומטשטש את הטקסט (זה בדיוק הבאג שתוקן). כפתורי תרומה (Ko-fi/Buy Me a Coffee/Patreon, מ-`DONATE_LINKS`, דרך `donateMini()`) מופיעים בכל טאב חוץ מ-About (ששם יש את `donateCard()` המלא) + בתחתית מודל ההגדרות. **כל כפתור/אייקון ללא טקסט גלוי (`.mc`, `.hl`, `.stab`) חייב גם `aria-label` וגם `title`** — `aria-label` בלבד לא מציג tooltip בהובר לעכבר. **כל `<select>` חדש חייב גם `select option{background:...;color:...}`** (ראה `.fs option,.ls option`) — דפדפנים לא מיישמים את צבעי ה-select על פופאפ ה-option באופן אוטומטי, ובלי זה טקסט לבן על רקע לבן במצב כהה.
- **מקלטים על המפה** (`tglShl()`): מרקר מציג רק נקודה (`.md`) + `bindPopup()` בלחיצה — **בלי** תווית טקסט קבועה (`.ml`) מעל המרקר. עם מאות מקלטים אמיתיים בעיר אחת (ת"א), תווית קבועה לכל מרקר נמרחת לכתם בלתי קריא בכל זום; ה-popup בלחיצה מספיק. (מרקרי אזעקה ב-`addMrk()` כן משתמשים ב-`.ml` — שם הכמות קטנה מספיק שזה לא בעיה.) הפופאפ (`shelterPopup()`) כולל גם קישורי ניווט (Waze + Google Maps) לקואורדינטת המקלט.
- *(אילוץ קריטי — הועבר ל-[AGENTS.md](../AGENTS.md#אילוצים-קריטיים--חובה-לפני-עריכה))*
- *(אילוץ קריטי — הועבר ל-[AGENTS.md](../AGENTS.md#אילוצים-קריטיים--חובה-לפני-עריכה))*
- *(אילוץ קריטי — הועבר ל-[AGENTS.md](../AGENTS.md#אילוצים-קריטיים--חובה-לפני-עריכה))*
- **מפה**: Leaflet, כל שכבות הבסיס דרך Esri (`server.arcgisonline.com`, ללא מפתח API בשום מצב — hostname אחד ל-CSP `img-src`/SW tile-cache). מצב רגיל (בהיר/כהה): `Canvas/World_{Dark,Light}_Gray_Base` + שכבת שמות/גבולות נפרדת `Canvas/World_{Dark,Light}_Gray_Reference` (`basemapRef`, `pane:'labelsPane'`, תמיד דלוקה — לא ניתנת לכיבוי) — **עד 2026-08 היה זה CartoDB** (`basemaps.cartocdn.com`); הוחלף כי CARTO דרשו מפתח API והתחילו למרוח "API KEY REQUIRED" על כל אריח. **חשוב**: ל-Canvas layers (base+reference) אין כיסוי אמיתי מעבר לזום 16 ברוב האזורים (בניגוד ל-World_Imagery) — `tileOpts()` קובע `maxNativeZoom:16` כדי ש-Leaflet יגדיל (upscale) את האריח האחרון במקום לבקש אריחים לא-קיימים/ריקים. שכבת לוויין חינמית — Esri World Imagery — דרך כפתור 🛰️ ב-`.mc` (`tglSat()`); מעליה אפשר להציג/להסתיר שכבת שמות מקומות נפרדת (`Reference/World_Boundaries_and_Places`, גם היא ב-`labelsPane`) דרך כפתור 🏷️ (`satLblB`/`tglSatLabels()`, מוצג רק כש-`satOn` — זו כן ניתנת לכיבוי, בשונה מ-`basemapRef`).
- **PWA**: SW מקודד בתוך `server.js` (משתנה `SW`), מטמון `red-alert-v18` + מטמון אריחים נפרד `red-alert-tiles-v2` (Leaflet basemap כולל לוויין ושכבת שמות, cache-first). שינוי ל-SW דורש bump של `CN` ב-server.js. **שים לב**: `TILE` הוא מטמון נפרד שה-`activate` handler *לעולם לא* מנקה (כדי ששטחים שכבר נצפו יעבדו אופליין) — אם משנים URL/ספק של אריחים, חובה ל-bump גם את `TILE`, אחרת אריחים ישנים/פגומים נשארים במטמון של משתמשים קיימים לצמיתות. v1.6.1 (מעבר CARTO→Esri) פספס את זה; תוקן ב-v1.6.2.


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

`/metrics` — basic auth, פורמט 0.0.4. כל מטריקה משויכת ל-`alertmap_*` namespace. מטריקות gauge מציגות מצב נוכחי, counters לא יורדים לעולם. ראה [server.js](../server.js) `prometheusMetrics()` לרשימה מלאה.


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
| [test/unit.js](../test/unit.js) | unit (פונקציות פניניות + שלמות i18n) | `node:test` המובנה |
| [test/integration.js](../test/integration.js) | אינטגרציה ברמת API (mock OREF → SSE), בלי דפדפן | `node:test`-style ידני (assert עצמאי) |
| [test/e2e.js](../test/e2e.js) | E2E בדפדפן אמיתי (Playwright, `channel:'chrome'`) — כל טסט מקושר לבאג UI ספציפי מה-CHANGELOG | `node:test` המובנה + Playwright |

`test/unit.js` מייבא את הפונקציות מ-[lib.js](../lib.js) ישירות (`require('../lib.js')`) — אותו קובץ שהקליינט טוען. אין יותר שכפול: עריכה ב-`lib.js` משפיעה גם על הקליינט וגם על הטסטים. `shelterClass` ב-lib מחזיר `immediate/fast/medium/slow`; הקליינט ממפה ל-CSS suffix קצר (`imm/fast/med/slow`) דרך `SHC_MAP`. `formatShelter(s, labels)` מקבל את מחרוזות התרגום כפרמטר (הקליינט מעביר `t(...)`, הטסטים מעבירים עברית).

**⚠️ למה `test/e2e.js` קיים בנוסף לשני האחרים**: `test/unit.js`/`test/integration.js` בודקים לוגיקה טהורה ותשובות API — אף אחד מהם לא מריץ דפדפן אמיתי, ולכן אף אחד לא היה תופס את רוב באגי ה-UI שתוקנו בפועל בין 1.2.0 ל-1.4.1 (פוקוס שנעלם, טאב שמתאפס, רוחב CSS שקורס, תוויות שנמרחות, צבעי option לא קריאים) — כל אלה התגלו רק כי המשתמש בדק ידנית וצילם מסך. `test/e2e.js` סוגר את הפער: כל טסט שם משחזר תרחיש אמיתי שהיה שבור בעבר. **חובה** להוסיף טסט E2E חדש כשמתקנים כל באג UI עתידי מהסוג הזה — אחרת הוא יחזור בשקט בריפקטור הבא. `channel:'chrome'` מונע הורדת דפדפן bundled של Playwright (יש Chrome/Edge מותקן מקומית ממילא); ב-CI (`.github/workflows/test.yml`, job `e2e`) זה נשען על ה-Chrome המובנה של runner ה-ubuntu-latest.


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
- **בדיקת `node test/unit.js` כושלת על `health fetch error`** — הפורט תפוס, או `server.js` לא קיים. הבדיקה משתמשת בפורט 3001-4000 רנדומלי.
- **PWA לא מתעדכן** — DevTools → Application → Service Workers → Unregister, או bump של `CN` ב-`SW` בתוך server.js.
- **אזעקות כפולות** — הדפדפן פתוח ב-2 טאבים; כל אחד מקבל SSE עצמאי. תקין.
- **המפה מטושטשת בזום עמוק מאוד (light/dark)** — תקין; `maxNativeZoom:16` על שכבות ה-Esri Canvas גורם ל-Leaflet להגדיל (upscale) את האריח האחרון מעבר לזום 16 במקום לבקש אריחים לא-קיימים. מרקרים/מקלטים לא מושפעים (הם overlay וקטורי, לא חלק מהאריח).
- **אריחי מפה ישנים/שבורים ממשיכים להופיע אצל משתמש ספציפי אחרי תיקון בקוד** — כנראה שכחת לבמפ את `TILE` (לא רק `CN`) ב-server.js; `TILE` הוא מטמון SW נפרד שלעולם לא מתנקה אוטומטית.


## Dependabot / תלויות פגיעות — היסטוריה

ב-2026-08-29 GitHub דיווח 8 alerts (1 critical, 2 high, 5 moderate) בפעם הראשונה ש-`pnpm-lock.yaml` הוכנס ל-git (זה first-visibility — Dependabot סורק רק lockfile שכבר ב-repo, לא regression חדש). נבדק ישירות מול `gh api repos/.../dependabot/alerts`: **7 מתוך 8** (`request`, `form-data` פעמיים כולל ה-critical, `qs` פעמיים, `uuid`, `tough-cookie`) חזרו לאותה שרשרת אחת — הלקוח הישן `request`/`@cypress/request` שנמשך טרנזיטיבית ע״י `node-telegram-bot-api@0.66.0` (שהיה `optionalDependency`). השימוש היחיד בספרייה הזו בקוד היה `new TelegramBot(token,{polling:false})` + `bot.sendMessage(...)` — קריאת API בודדת. **תוקן**: `telegram-bot.js` נכתב מחדש לקרוא ל-`api.telegram.org` ישירות דרך `https` גולמי (אותו סגנון כמו `sendDiscord()`), ו-`node-telegram-bot-api` הוסר לגמרי מ-`package.json` — מסיר את כל השרשרת, בלי `npm install` בכלל. **1 מתוך 8** (`js-yaml`, high, DoS ב-`!!omap`) מגיע מ-`eslint@9.39.5`→`@eslint/eslintrc`, `devDependency` בלבד שרץ רק לוקאלית/ב-CI. הפרויקט לא מפרסר YAML לא-מהימן באף מקום (openapi.yaml הוא סטטי ומוגש כמו שהוא, לא עובר `js-yaml`). **התקבל כסיכון, לא תוקן** — הסרתו דורשת מעבר `.eslintrc.json`→flat config (`eslint.config.js`) והעלאת `engines.node` ל-`^20.19||^22.13||>=24` (הפרויקט מצהיר `>=18`), לא פרופורציונלי לאזהרת lint-only שאינה ניתנת לניצול. פירוט מלא ב-[.github/SECURITY.md](../.github/SECURITY.md#dependabot-alerts).


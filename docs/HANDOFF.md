# HANDOFF.md — מצב נוכחי ומשימות פתוחות

קצר בכוונה. כללי עבודה ואילוצים קריטיים: [AGENTS.md](../AGENTS.md). פירוט טכני: [ARCHITECTURE.md](ARCHITECTURE.md). **עדכן את הקובץ הזה בסוף כל סשן משמעותי** (מצב + משימות), ואל תוסיף אליו תיעוד כללי.

## מצב נכון ל-2026-10-17

| | |
|---|---|
| גרסה | **v1.6.5** (תג + release + באנר קיימים). CI ירוק על `main` |
| בדיקות | unit 114 · integration 21 · E2E 12 · lint נקי |
| אתר חי | https://red-alert-ten.vercel.app — **עובד טכנית** (smoke עבר), אבל **לא מקבל אזעקות אמיתיות**: פיקוד העורף חוסם IP לא-ישראלי ו-Vercel מקפיא טיימרים. מציג באנר אזהרה "אין חיבור למקור הנתונים" ו-`/api/health` מחזיר `degraded` (מכוון) |
| מקור הנתונים | `oref.org.il` נגיש מהמחשב של המשתמש (IP ישראלי). נקודת ההיסטוריה `AlertsHistory.json` מחזירה גוף ריק — לא ברור אם הוצאה משימוש או שפשוט שקט; `alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=1` מחזיר `[]` |
| repo | `DrummingBird1/RedAlert` (השם נשאר, המותג "צפיר/Tzafir"). Vercel: פרויקט `red-alert`, פורס אוטומטית מ-`main` |

## משימות פתוחות (לפי עדיפות)

### 1. אירוח על ה-NAS של המשתמש (ZimaOS) — כדי לקבל אזעקות אמיתיות
**למה זה הפתרון:** ל-NAS יש IP ביתי ישראלי (פיקוד העורף מקבל אותו), והוא רץ 24/7. Vercel לא יכול לסקור אזעקות גם בתיאוריה, אז האפליקציה כולה צריכה לרוץ על ה-NAS; Vercel נשאר קישור/מתפנה.
**שאלות פתוחות למשתמש** (טרם נענו): יש דומיין? (Cloudflare Tunnel) או Tailscale Funnel (בלי דומיין)? יש SSH לטרמינל של ZimaOS או רק ממשק Docker?
**מה להכין:**
- `docker-compose.yml`: להוסיף `DATA_DIR=/app/data` ולהסתמך על `./data:/app/data` בלבד (כיום מעלה `./data` אבל השרת כותב ל-`/app` — ההיסטוריה אובדת בכל עדכון); `TZ=Asia/Jerusalem`; `restart: unless-stopped` (כבר יש). הסרת `./logs` הנפרד (הלוגים ב-`DATA_DIR/logs`).
- אימג' מוכן: workflow חדש `.github/workflows/docker.yml` שבונה ודוחף ל-GHCR בתג `v*` (`docker/build-push-action`, הרשאת `packages: write`, תגיות `latest` + גרסה, `workflow_dispatch` לבדיקה). אז ב-NAS רק `image: ghcr.io/drummingbird1/redalert:latest`. חלופה בלי workflow: `git clone` + `docker compose up -d --build` על ה-NAS.
- חשיפה לאינטרנט: Cloudflare Tunnel (דומיין) / Tailscale Funnel (בלי דומיין) / פורט בנתב + DDNS (לא עובד מאחורי CGNAT). לא להשאיר את `/admin` חשוף בלי `ADMIN_PASS` חזק (+ `ADMIN_TOTP_SECRET`).
- אזהרה: מגבלת הקצב סומכת על הערך הראשון ב-`X-Forwarded-For` — ניתן לזיוף אלא אם מאחורי proxy מהימן (Cloudflare/Tailscale בסדר).
- אימות: `node scripts/smoke.mjs https://<כתובת-ה-NAS>` ובדיקה ש-`last_poll_ago` ב-`/api/health` הוא מספר קטן ולא `null`. אחרי שעובד: לעדכן את הקישור "גרסה חיה" ב-README ובהגדרות הריפו (`gh repo edit --homepage`), ולהחליט מה עושים עם Vercel.

### 2. השלמת התרגום (גרסה 1.7.0)
מילון `LN` מלא ב-14 שפות, אבל חלקים גדולים בממשק עדיין קשיחים בעברית — **הכי חמור: הנחיית ההצלה** "היכנס למרחב מוגן עכשיו!" + "ממ״ד, מקלט, או חדר מדרגות פנימי" + "✓ אני בסדר". עוד: מוני הסרגל העליון (היום/סה״כ/מחובר), כל טאב "אודות", כל חלון ההגדרות, תוויות הפילטרים (כל האזורים/הכל/רקטות/כטב״מ/שעה/יום/שבוע/נקה/קפוץ ליישוב), "▶ הפעל", תוויות הסטטיסטיקה, סטטוס החיבור (מחובר/מנותק/מתחבר...), הודעת התקנה ל-iOS.
**גישה:** להוסיף מפתחות ל-`LN` (14 שפות — טסט שוויון מפתחות קיים ויכשיל חוסר), להחליף קשיחים ב-`t()`/`data-i18n`, טסט E2E ב-`?lang=en` שאין עברית בטקסט הממשק (חוץ מנתונים: שמות ערים/אזורים, יומן שינויים). להתחיל מהנחיית ההצלה. תרגומי am/ti הם best-effort. דורש גם bump של `CN` ב-`server.js`.

### 3. קטנים
- `deploy.yml` (Fly.io) אדום בכל push — `FLY_API_TOKEN` לא הוגדר מעולם. החלטת המשתמש: להגדיר, או למחוק את ה-workflow ואת `fly.toml`.
- 5 PRs פתוחים של Dependabot (eslint 10, actions/checkout 7, setup-node 7, node 26-alpine, playwright 1.63) — לבדוק אחד אחד מול CI, לא למזג בבת אחת.
- ענפים ו-worktrees ישנים מסשנים קודמים: `.claude/worktrees/*`, ענפי `claude/*`, `fix/*`. לבדוק `git status` בכל worktree לפני כל מחיקה.
- פערי לינט: ה-JS שבתוך `index.html`, `lib.js`, `scripts/`.
- סינון סוג אזעקה כולל רק רקטות/כטב״מ (חסרים רעידת אדמה/צונאמי). הקונטיינר רץ כ-root ואין `.dockerignore`. ב-`?embed=1` נשארת גם `X-Frame-Options: DENY` (לא מזיקה ב-Chromium כי `frame-ancestors *` גובר; ראוי להסיר). אייקון ה-PWA הוא SVG בלבד (iOS רוצה PNG).

## איך עובדים עם המשתמש הזה
- עברית, תמציתי, כן. הוא דוחף בחזרה כשמשהו נשמע "בסדר" מדי — בודקים שוב בהרצה אמיתית ולא מתגוננים.
- **המכסה שלו מוגבלת** — לא לבזבז טוקנים: לא לקרוא קבצים גדולים בשלמותם (ראו "קריאת הקוד בזול" ב-AGENTS.md), לא להריץ סוכני-משנה, לאגד פקודות, ולא לתעד יותר מדי.
- לשמור על שורש נקי. לפני דחיפה/תיוג/מחיקה — לוודא שהתבקשתם.

## פקודות שימושיות
```bash
pnpm run lint && node test/unit.js && node test/integration.js && node test/e2e.js   # הכל
node scripts/smoke.mjs https://red-alert-ten.vercel.app --expect-version 1.6.5       # אתר פרוס
node scripts/release-banner.mjs 1.6.6                                                 # באנר ל-release חדש
gh run list --workflow=test.yml --branch main --limit 3                               # CI
gh release create vX.Y.Z --verify-tag --title "..." --notes-file notes.md --latest   # אחרי: tag annotated + push tag
```
תהליך release מלא: שלב 8 ב-[AGENTS.md](../AGENTS.md#איך-להוסיף-תכונה--לשנות-קוד).

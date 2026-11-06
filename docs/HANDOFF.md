# HANDOFF.md — מצב נוכחי ומשימות פתוחות

קצר בכוונה. כללי עבודה ואילוצים קריטיים: [AGENTS.md](../AGENTS.md). פירוט טכני: [ARCHITECTURE.md](ARCHITECTURE.md). **עדכן את הקובץ הזה בסוף כל סשן משמעותי** (מצב + משימות), ואל תוסיף אליו תיעוד כללי.

## מצב נכון ל-2026-11-06

| | |
|---|---|
| גרסה | **v1.6.5** (תג + release + באנר קיימים). ב-`main` ממוזגים בנוסף #15 (ROADMAP.md) ו-#14 (docker-compose + workflow ל-GHCR + תרגום הנחיית ההצלה, `CN=red-alert-v19`) — **טרם שוחררו** (אין תג, ה-`package.json` עדיין 1.6.5). CI ירוק על `main` (פרט ל-Fly.io — ידוע) |
| בדיקות | unit 115 (הורץ מקומית ב-2026-11-06) · integration 21 · E2E 12 · lint נקי (CI ירוק על `d500f91`) |
| אתר חי | https://red-alert-ten.vercel.app — **עובד טכנית** (smoke עבר), אבל **לא מקבל אזעקות אמיתיות**: פיקוד העורף חוסם IP לא-ישראלי ו-Vercel מקפיא טיימרים. מציג באנר אזהרה "אין חיבור למקור הנתונים" ו-`/api/health` מחזיר `degraded` (מכוון) |
| מקור הנתונים | `oref.org.il` נגיש מהמחשב של המשתמש (IP ישראלי). נקודת ההיסטוריה `AlertsHistory.json` מחזירה גוף ריק — לא ברור אם הוצאה משימוש או שפשוט שקט; `alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=1` מחזיר `[]` |
| repo | `DrummingBird1/RedAlert` (השם נשאר, המותג "צפיר/Tzafir"). Vercel: פרויקט `red-alert`, פורס אוטומטית מ-`main` |

## משימות פתוחות (לפי עדיפות)

### 1. אירוח על ה-NAS של המשתמש (ZimaOS) — כדי לקבל אזעקות אמיתיות
**למה זה הפתרון:** ל-NAS יש IP ביתי ישראלי (פיקוד העורף מקבל אותו), והוא רץ 24/7. Vercel לא יכול לסקור אזעקות גם בתיאוריה, אז האפליקציה כולה צריכה לרוץ על ה-NAS; Vercel נשאר קישור/מתפנה.
**שאלות פתוחות למשתמש** (טרם נענו): יש דומיין? (Cloudflare Tunnel) או Tailscale Funnel (בלי דומיין)? יש SSH לטרמינל של ZimaOS או רק ממשק Docker?
**נעשה (#14, ממוזג ב-`main` ב-2026-11-05):**
- `docker-compose.yml`: `DATA_DIR=/app/data`, `TZ=Asia/Jerusalem`, רק `./data:/app/data` (הוסר `./logs` הנפרד; הלוגים ב-`DATA_DIR/logs`).
- `.github/workflows/docker.yml`: בונה ודוחף ל-`ghcr.io/drummingbird1/redalert` בתג `v*` או ב-`workflow_dispatch`; תגיות `latest` + גרסה.

**נשאר:**
- **ה-workflow מעולם לא רץ** (0 ריצות; התג האחרון v1.6.5 קדם לו), כלומר אין עדיין אימג'. להריץ ידנית (`workflow_dispatch`) או עם התג הבא, ולבדוק שהחבילה נגישה מה-NAS (חבילת GHCR חדשה עלולה להיות פרטית — להפוך לציבורית או להתחבר). לא נבדק מה קיים ב-GHCR (חסרה הרשאת `read:packages`).
- ה-compose עדיין `build: .`. לשימוש באימג' מוכן: `image: ghcr.io/drummingbird1/redalert:latest` (או קובץ compose נפרד ל-NAS). חלופה בלי workflow: `git clone` + `docker compose up -d --build` על ה-NAS.
- ב-README וב-ARCHITECTURE אין התייחסות ל-GHCR או ל-NAS — להוסיף הוראות הרצה קצרות.
- חשיפה לאינטרנט: Cloudflare Tunnel (דומיין) / Tailscale Funnel (בלי דומיין) / פורט בנתב + DDNS (לא עובד מאחורי CGNAT). לא להשאיר את `/admin` חשוף בלי `ADMIN_PASS` חזק (+ `ADMIN_TOTP_SECRET`).
- אזהרה: מגבלת הקצב סומכת על הערך הראשון ב-`X-Forwarded-For` — ניתן לזיוף אלא אם מאחורי proxy מהימן (Cloudflare/Tailscale בסדר).
- אימות: `node scripts/smoke.mjs https://<כתובת-ה-NAS>` ובדיקה ש-`last_poll_ago` ב-`/api/health` הוא מספר קטן ולא `null`. אחרי שעובד: לעדכן את הקישור "גרסה חיה" ב-README ובהגדרות הריפו (`gh repo edit --homepage`), ולהחליט מה עושים עם Vercel.

### 2. השלמת התרגום (גרסה 1.7.0)
**נעשה (#14, ממוזג ב-`main`):** הנחיית ההצלה ("היכנס למרחב מוגן עכשיו!" / "ממ״ד, מקלט, או חדר מדרגות פנימי" / "✓ אני בסדר") — 4 מפתחות חדשים ב-`LN` (`goShelter`, `shelterWhere`, `imSafe`, `imSafeAria`) בכל 14 השפות, מחוברים ב-`data-i18n` / `data-i18n-aria`, הודעת השיתוף "אני בסדר" נבנית מ-`t('imSafe')`, `CN` עלה ל-`red-alert-v19`, ונוסף טסט יחידה שאין עברית בשפות שאינן עברית. **לא אומת בדפדפן**: אין טסט E2E שמוודא שההנחיה מוצגת מתורגמת ב-`?lang=en`. תרגומי am/ti הם best-effort ולא נבדקו ע״י דוברים.
**נשאר (1.7.0):** מילון `LN` מלא ב-14 שפות, אבל חלקים גדולים בממשק עדיין קשיחים בעברית — מוני הסרגל העליון (היום/סה״כ/מחובר), כל טאב "אודות", כל חלון ההגדרות, תוויות הפילטרים (כל האזורים/הכל/רקטות/כטב״מ/שעה/יום/שבוע/נקה/קפוץ ליישוב), "▶ הפעל", תוויות הסטטיסטיקה, סטטוס החיבור (מחובר/מנותק/מתחבר...), הודעת התקנה ל-iOS.
**גישה:** להוסיף מפתחות ל-`LN` (14 שפות — טסט שוויון מפתחות קיים ויכשיל חוסר), להחליף קשיחים ב-`t()`/`data-i18n`, טסט E2E ב-`?lang=en` שאין עברית בטקסט הממשק (חוץ מנתונים: שמות ערים/אזורים, יומן שינויים) — כולל הנחיית ההצלה. דורש גם bump של `CN` ב-`server.js`.

### 3. קטנים
- `deploy.yml` (Fly.io) אדום בכל push — `FLY_API_TOKEN` לא הוגדר מעולם. החלטת המשתמש: להגדיר, או למחוק את ה-workflow ואת `fly.toml`.
- 5 PRs פתוחים של Dependabot (eslint 10, actions/checkout 7, setup-node 7, node 26-alpine, playwright 1.63) — לבדוק אחד אחד מול CI, לא למזג בבת אחת.
- ענפים ו-worktrees ישנים מסשנים קודמים: `.claude/worktrees/*`, ענפי `claude/*`, `fix/*`. לבדוק `git status` בכל worktree לפני כל מחיקה. הענפים `docs/roadmap` (#15) ו-`feat/nas-docker-and-i18n` (#14) כבר ממוזגים ל-`main` (squash) וניתנים למחיקה.
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

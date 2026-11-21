# ARCHITECTURE.md — technical depth (read as needed)

English · [עברית](ARCHITECTURE.he.md)

Split out of [AGENTS.md](../AGENTS.md) to save tokens in every session. **Read only the section relevant to your task.** To find a section: `grep -n "^## \|^### \|^- \*\*" docs/ARCHITECTURE.md`.
The iron rules and critical constraints live in [AGENTS.md](../AGENTS.md).

## Environment variables

| Variable | Default | Note |
|---|---|---|
| `PORT` | `3000` | Server port |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / *(random)* | If `ADMIN_PASS` is unset, it is generated at startup and printed once to the log (it changes on every restart until a fixed value is set). |
| `ADMIN_TOTP_SECRET` | (empty) | TOTP secret (base32). When set, enables 2FA on `/admin` and `/metrics`: the Basic Auth password becomes `ADMIN_PASS` plus a 6-digit code from an authenticator app. The QR URI is printed to the log at startup. No npm dependency: built-in `crypto` HMAC-SHA1. |
| `FALLBACK_ALERT_URL` | (empty) | Alternative URL used after 5 OREF failures |
| `HEALTH_WEBHOOK` | (empty) | URL to POST to when the server is degraded/recovered |
| `DISCORD_WEBHOOK_URL` | (empty) | Discord channel webhook (Channel Settings → Integrations → Webhooks). Sends an embed for every new real alert batch from `pollAlerts()`. No SDK, a plain POST over `https`. |
| `TELEGRAM_TOKEN` / `TELEGRAM_CHANNEL` | (empty) | For the bot only |
| `OREF_URL_OVERRIDE` / `OREF_HIST_OVERRIDE` | (empty) | Replace the OREF URL (tests only; `test/integration.js` and `test/e2e.js` use this) |
| `DATA_DIR` | repo folder | Where runtime files are written: `logs/`, `.store-snapshot.json`, `.vapid-keys.json`, `.push-subs.json`. **Every test that starts `server.js` must pass a temporary folder**, otherwise it writes fake alerts into the developer's real history/logs (the next `node server.js` would load them as history). |
| `RATE_LIMIT_PER_MIN` | `120` | Requests-per-minute limit per IP. The override exists for `test/e2e.js` only: one browser is one IP, and a full suite of page loads exceeds 120 per minute (`GET /` itself got 429 and caused random test failures). |
| `SHELTERS_URL` | (empty) | External JSON of real shelters (`[{lat,lng,n}]`); the client replaces the ~35 illustrative examples if found. **There is no open CKAN dataset of shelters on data.gov.il** (checked: 0 results); the default is rough city-center points marked "example", not verified addresses. **Exceptions: Tel Aviv-Yafo, Jerusalem, Haifa.** When `SHELTERS_URL` is unset, the client automatically fetches real data from the open municipal GIS layers of the three cities (`GET /api/shelters/{tel-aviv,jerusalem,haifa}`, each a server-side cached proxy with a 24h TTL; see `makeShelterFetcher()`/`getTelAvivShelters()`/`getJerusalemShelters()`/`getHaifaShelters()` in server.js) and replaces the generic examples for those cities with them; `loadExternalShelters()` in index.html also removes exact-coordinate duplicates (some municipal sources return the same structure twice). The other cities stay illustrative. **Beer Sheva** has a real entry in ArcGIS Hub (`gis-beer-sheva.opendata.arcgis.com`, ~81 records) but the actual endpoint (`opendatagis.br7.org.il`) did not respond from here (probably blocked outside Israel), so it was not connected. **Rishon LeZion**/**Petah Tikva** were checked and have no open GIS layer for shelters (only a static PDF). |


## Architecture — essentials

### Server ([server.js](../server.js))

- **Single polling loop**: `setInterval(pollAlerts, 2000)` pulls OREF, computes a hash, adds to a global list (`store`, max 5000) and broadcasts to all SSE clients. Alerts are "active" for 90 seconds and then become history.
- **SSE** at `/api/stream`: sends init, then an update on every change, with a heartbeat every 2s.
- **Deduplication**: `lastHash` is cleared after 30 seconds. An identical alert within half a minute counts as a repeat.
- **Fallback**: after 5 consecutive failures, switches to `FALLBACK_ALERT_URL`. Checks for a return to OREF every 60s.
- **Web Push**: only if `web-push` is installed. VAPID keys are saved in `.vapid-keys.json` and created automatically. The client subscribes through `wpSub()` and sends `subscription` + `favs` + `dnd` to `/api/push/subscribe`; the server filters pushes by favorite city and sends `silent` during quiet hours.
- **Feed health (`upstreamOk()`)**: `/api/health` returns `status:'degraded'` + `upstream_ok:false` when the OREF feed is not answering. Once answered: silence >30s; never answered: 3 consecutive failures **or 30s since startup** (the decision is `AlertLib.upstreamOk()` in lib.js, a pure function with injected times). **The wall-clock criterion is critical**: a host that freezes timers between requests (Vercel) almost never runs the polling loop, so the failure count never reaches 3 even after minutes of uptime. v1.6.3 decided by count alone and reported `ok` on the live site (`last_poll_ago:null`, uptime 100s). Always HTTP 200 (the Docker/Fly healthcheck depends on it). The client (`checkUpstream()`, every 30s and on every SSE connection) shows `#upBar` and a "no connection to the source" state in the bar instead of "all quiet". **Why this exists**: the Home Front Command (Akamai) blocks non-Israeli IPs. The live site on Vercel (Frankfurt/Washington) got "Access Denied" and never showed a real alert, while `/api/health` reported `ok` and the client showed "connected" and "all quiet". Every host must run from Israel or set `FALLBACK_ALERT_URL`.
- **Rate limit**: 120 requests per minute per IP. Clipped by a `setInterval` every 5 minutes.
- **Gzip**: only for content >1KB and certain MIME types.
- *(Critical constraint, moved to [AGENTS.md](../AGENTS.md))*
- **HTML cache**: `getHtml()` reads `index.html` and keeps it in memory by mtime, so a file change is picked up without a restart.
- **Admin dashboard**: `/admin` with Basic auth, polls `/api/admin/metrics` every 5s.
- **Security headers**: only on HTML responses. JSON endpoints do not get `X-Content-Type-Options` etc.

### Client ([index.html](../index.html))

- **Hand-compressed JS**: single-letter variable names, 2-3 letter function names (`X`=escape, `t`=translate, `C`=cities, `TM`=type map, `RS`=region shelter, `SHL`=shelters list). This is not automatic minification; to edit, read each line carefully.
- **Global state**: `hist`, `act` (Map), `mrk` (Map), `known` (Set), `favs`, `flt`, `theme`, etc. No framework.
- **Persistence**:
  - `localStorage`: lang, theme, favs, dnd, tts, siren, hc, cls, push.
  - `IndexedDB` (`alertmap` v1, store `alerts`): long-term history for comparisons (today/yesterday/weekAvg).
- **SSE + fallback polling**: `connectSSE()` + `startPoll()` runs every 5s only if `sseOK=false`.
- **Cities (`C`)**: a static dict of ~55 cities with lat/lng, region, shelter time (not 130+ as in the README).
- **Fuzzy matching (`findC`)**: exact → normalized → substring → word-by-word. Supports "תל אביב - יפו" → "תל אביב".
- **i18n (`LN`)**: 14 languages: he/en/ar/ru plus am (Amharic) / ti (Tigrinya) / th (Thai) / tl (Tagalog) / uk (Ukrainian) / fr / es / ro / hi / zh. `t(key)` with a fallback to Hebrew; all languages have the same key set + LANG_META + TTS_LOCALE (checked automatically in test/unit.js, describe('i18n completeness')). RTL/LTR direction goes through `AlertLib.isRTL(lang)` (only he/ar are RTL), a pure function in lib.js, not inline logic. A first visit without `?lang=`/localStorage keeps guessing from `navigator.languages` (`detectBrowserLang()` → `AlertLib.detectLang()` in lib.js: splits on `-`/`_` rather than `slice(0,2)`, because "fil-PH" became "fi" and fell back to Hebrew; aliases `fil→tl`, `iw→he`) before falling back to Hebrew. ⚠️ **Translation coverage is partial**: the `LN` dictionary is complete in 14 languages, but many UI strings are still hard-coded in Hebrew: the "get to a protected space now!" banner + the protection instruction + "I'm safe", the top counters, the whole About tab, the whole Settings window, the filter labels and the "connected/disconnected" badge. Do not claim the UI is "translated into 14 languages" without saying so. The am/ti translations are best-effort (low-resource languages); native-speaker verification is recommended before operational reliance. `<select id="langS">` is built dynamically in JS from `AlertLib.LANG_META` (no more manual `<option>` editing in index.html). TTS uses the translated `ttsPrefix` prefix and the locale from `AlertLib.TTS_LOCALE[lang]`. `speak(cities)` takes an array and speaks once per batch: calling it in a loop per city would cancel (`speechSynthesis.cancel()`) the previous one before it was heard.
- **Menus/tabs**: `alerts` (default, includes a city search bar with autocomplete from `<datalist id="cityList">` (populated once on DOMContentLoaded from `citySelOptions()`), a "jump to locality" selector (`citySelOptions()`/`jumpToCity()`) and filtering) / `stats` / `history` (loads **all** history from IndexedDB through `gDB()`, not just the 500 in `hist` in memory; its own date range + search, also with `list="cityList"`, including replay: `▶ Play` flies the map chronologically over `historyReplayList`, rebuilt on every render, `setInterval` at a fixed rate, `stopReplay()` is always called when leaving the tab or changing the filter) / `updates` (shows the static `CHANGES` array, also shows a one-time "what's new" popup through `checkWhatsNew()`, which compares `APP_VERSION` with `localStorage['alertmap-lastver']`) / `about`. Desktop: `.stabs`/`swTab()`: every `.stab` is `display:flex;flex-direction:column` (icon in `.si` on top, translated label `<span data-i18n>` below), **in addition to** `aria-label` + `title`. **⚠️ Why column and not inline**: until v1.6.1 only Alerts had visible text (the other tabs were icon-only with a hover title); when visible text was added to all of them in a plain inline layout, long words ("Statistics") wrapped to a second line while short ones ("About") stayed on one line: uneven height and a broken look. A column layout with `.si{font-size:13px}` gives exactly the same height to all 5 tabs regardless of word length. There is an E2E test for this regression. Mobile: `.mn-i`/`mobTab()` (copies `#sbC` into `#mSheet`; async tabs such as history are returned as a Promise so the copy waits for the render). **`.mn-i` must have an explicit `width:100%`**: `.mn` becomes `display:flex` on mobile, so `.mn-i` (its child) is a flex item that shrinks to content width without an explicit `width`/`flex`, which crowds all 6 bottom navigation buttons into one corner and blurs the text (this is exactly the bug that was fixed). Donation buttons (Ko-fi/Buy Me a Coffee/Patreon, from `DONATE_LINKS`, via `donateMini()`) appear in every tab except About (which has the full `donateCard()`) plus at the bottom of the Settings modal. **Every button/icon without visible text (`.mc`, `.hl`, `.stab`) must have both `aria-label` and `title`**: `aria-label` alone shows no tooltip on mouse hover. **Every new `<select>` must also get `select option{background:...;color:...}`** (see `.fs option,.ls option`): browsers do not apply select colors to the option popup automatically, and without it you get white text on a white background in dark mode.
- **Shelters on the map** (`tglShl()`): a marker shows only a dot (`.md`) + `bindPopup()` on click, **without** a permanent text label (`.ml`) above the marker. With hundreds of real shelters in one city (Tel Aviv), a permanent label on every marker smears into an unreadable blob at every zoom; the popup on click is enough. (Alert markers in `addMrk()` do use `.ml`: the count there is small enough that it is not a problem.) The popup (`shelterPopup()`) also includes navigation links (Waze + Google Maps) to the shelter's coordinate.
- *(Critical constraints, moved to [AGENTS.md](../AGENTS.md))*
- **Map**: Leaflet, all base layers through Esri (`server.arcgisonline.com`, no API key in any mode: one hostname for the CSP `img-src`/SW tile-cache). Regular mode (light/dark): `Canvas/World_{Dark,Light}_Gray_Base` + a separate names/borders layer `Canvas/World_{Dark,Light}_Gray_Reference` (`basemapRef`, `pane:'labelsPane'`, always on, cannot be turned off). **Until 2026-08 this was CartoDB** (`basemaps.cartocdn.com`); it was replaced because CARTO required an API key and started stamping "API KEY REQUIRED" on every tile. **Important**: the Canvas layers (base + reference) have no real coverage beyond zoom 16 in most areas (unlike World_Imagery), so `tileOpts()` sets `maxNativeZoom:16` so that Leaflet upscales the last tile instead of requesting non-existent/empty tiles. A free satellite layer, Esri World Imagery, is toggled by the 🛰️ button in `.mc` (`tglSat()`); above it you can show/hide a separate place-names layer (`Reference/World_Boundaries_and_Places`, also in `labelsPane`) with the 🏷️ button (`satLblB`/`tglSatLabels()`, shown only when `satOn`; this one can be turned off, unlike `basemapRef`).
- **PWA**: the SW is encoded inside `server.js` (variable `SW`), cache `red-alert-v18` + a separate tile cache `red-alert-tiles-v2` (Leaflet basemap including satellite and the names layer, cache-first). A change to the SW requires bumping `CN` in server.js. **Note**: `TILE` is a separate cache that the `activate` handler *never* clears (so areas already viewed work offline). If you change the tile URL/provider, you must also bump `TILE`, otherwise old/corrupt tiles stay in existing users' caches forever. v1.6.1 (the CARTO→Esri switch) missed this; fixed in v1.6.2.


## URL state (shareable links)

The client reads and writes the URL through `history.replaceState`. Synced state:

| param | On load | Sync back |
|---|---|---|
| `?lang=he\|en\|ar\|ru` | reads `lang`, overrides localStorage | `setLang()` |
| `?theme=light\|dark` | overrides auto-dark + localStorage | `applyTh()` |
| `?city=שדרות` | flyTo after `initMap` (not kept in the URL) | — |
| `?embed=1` | `document.documentElement.classList.add('embed')`: hides all the chrome | — |

`syncURL()` removes parameters equal to the default (he, dark) so the URL stays short.


## Embed widget

`/embed.js` is served as a loader script. External sites embed it with `<script src=".../embed.js" data-city="...">` and it injects an iframe to `/?embed=1&...`. `X-Frame-Options: DENY` and CSP `frame-ancestors 'self'` are lifted only when the URL contains `embed=1` (`secHeaders(res, true, isEmbed)`).


## Prometheus

`/metrics`: basic auth, format 0.0.4. Every metric is in the `alertmap_*` namespace. Gauge metrics show the current state; counters never decrease. See [server.js](../server.js) `prometheusMetrics()` for the full list.


## Keyboard shortcuts in the client

| Key | Action |
|---|---|
| `Space` | Mute/unmute sound |
| `S` | Siren (toggle) |
| `H` | Map home view |
| `M` | My location |
| `L` | Switch theme |
| `Esc` | Close the open modal |
| `?` | Toast with the list of shortcuts |

Shortcuts are disabled when focus is on `input/textarea/select`/contenteditable, or on a `<button>` (so that Space/Enter can activate the button), or when a modal is open (except ESC, which always closes).


## Tests

| File | Type | Runner |
|---|---|---|
| [test/unit.js](../test/unit.js) | unit (pure functions + i18n completeness) | built-in `node:test` |
| [test/integration.js](../test/integration.js) | API-level integration (mock OREF → SSE), no browser | manual `node:test`-style (own assert) |
| [test/e2e.js](../test/e2e.js) | real-browser E2E (Playwright, `channel:'chrome'`); every test is tied to a specific UI bug from the CHANGELOG | built-in `node:test` + Playwright |

`test/unit.js` imports the functions from [lib.js](../lib.js) directly (`require('../lib.js')`), the same file the client loads. There is no duplication any more: an edit in `lib.js` affects both the client and the tests. `shelterClass` in lib returns `immediate/fast/medium/slow`; the client maps it to a short CSS suffix (`imm/fast/med/slow`) through `SHC_MAP`. `formatShelter(s, labels)` takes the translation strings as a parameter (the client passes `t(...)`, the tests pass Hebrew).

**⚠️ Why `test/e2e.js` exists in addition to the other two**: `test/unit.js`/`test/integration.js` test pure logic and API responses. Neither runs a real browser, so neither would have caught most of the UI bugs that were actually fixed between 1.2.0 and 1.4.1 (focus that disappears, a tab that resets, collapsing CSS width, smeared labels, unreadable option colors). All of those were found only because the user checked by hand and took a screenshot. `test/e2e.js` closes the gap: every test there reproduces a real scenario that was once broken. **You must** add a new E2E test when fixing any future UI bug of this kind, otherwise it will quietly come back in the next refactor. `channel:'chrome'` avoids downloading a bundled Playwright browser (Chrome/Edge is installed locally anyway); in CI (`.github/workflows/test.yml`, job `e2e`) it relies on the built-in Chrome of the ubuntu-latest runner.


## API versioning

Every endpoint under `/api/X` is also available under `/api/v1/X` with an identical result. The aliasing is done by stripping `/v1/` from the start of the pathname before going over the endpoint table. A future breaking change could go under `/api/v2/`.


## OpenAPI

[openapi.yaml](openapi.yaml) is a spec of all the endpoints. It is exposed through `GET /api/spec` (and `/openapi.yaml`). Upload it to Swagger UI / Postman / Insomnia.


## Severity profiles in the client

Each alert type (`rockets`/`uav`/`earthquake`/`tsunami`) is tied to a profile in `ALERT_PROFILES` with:
- different `playSnd` frequencies (rockets 880-660Hz fast, earthquake 400Hz slow)
- a different vibration pattern
- a different pulse speed in CSS (`.cm.t-rockets`/`.cm.t-uav`/etc.)

Adding a new type requires updating 3 places: `TM` (icon/color), `ALERT_PROFILES` (sound/vibe), and CSS (`.cm.t-X`).


## Common debugging

- **The server shows "OREF back" but there are no alerts**: normal; it means the system went to the fallback and returned.
- **`node test/unit.js` fails on `health fetch error`**: the port is taken, or `server.js` does not exist. The test uses a random port in 3001-4000.
- **PWA does not update**: DevTools → Application → Service Workers → Unregister, or bump `CN` in `SW` inside server.js.
- **Duplicate alerts**: the browser is open in 2 tabs; each gets its own SSE. Normal.
- **The map is blurry at very deep zoom (light/dark)**: normal; `maxNativeZoom:16` on the Esri Canvas layers makes Leaflet upscale the last tile past zoom 16 instead of requesting non-existent tiles. Markers/shelters are not affected (they are a vector overlay, not part of the tile).
- **Old/broken map tiles keep appearing for a specific user after a code fix**: you probably forgot to bump `TILE` (not just `CN`) in server.js; `TILE` is a separate SW cache that is never cleared automatically.


## Dependabot / vulnerable dependencies — history

On 2026-08-29 GitHub reported 8 alerts (1 critical, 2 high, 5 moderate) the first time `pnpm-lock.yaml` was added to git (first visibility: Dependabot scans only a lockfile already in the repo, so this was not a new regression). Checked directly against `gh api repos/.../dependabot/alerts`: **7 of 8** (`request`, `form-data` twice including the critical, `qs` twice, `uuid`, `tough-cookie`) traced back to the same chain: the old `request`/`@cypress/request` client pulled transitively by `node-telegram-bot-api@0.66.0` (which was an `optionalDependency`). The only use of that library in the code was `new TelegramBot(token,{polling:false})` + `bot.sendMessage(...)`, a single API call. **Fixed**: `telegram-bot.js` was rewritten to call `api.telegram.org` directly over raw `https` (the same style as `sendDiscord()`), and `node-telegram-bot-api` was removed entirely from `package.json`, which removes the whole chain, with no `npm install` at all. **1 of 8** (`js-yaml`, high, DoS in `!!omap`) comes from `eslint@9.39.5`→`@eslint/eslintrc`, a `devDependency` that runs only locally/in CI. The project does not parse untrusted YAML anywhere (openapi.yaml is static and served as-is, it does not go through `js-yaml`). **Accepted as a risk, not fixed**: removing it requires moving `.eslintrc.json`→flat config (`eslint.config.js`) and raising `engines.node` to `^20.19||^22.13||>=24` (the project declares `>=18`), which is not proportional to a lint-only warning that cannot be exploited. Full details in [.github/SECURITY.md](../.github/SECURITY.md#dependabot-alerts).

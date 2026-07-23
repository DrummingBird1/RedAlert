# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project uses [SemVer](https://semver.org/).

## [Unreleased]

## [3.4.0]

### Fixed
- **City search input (`#fQ`/`#hQ`) kicked focus out of the field after one keystroke.**
  `renderSB()`/`renderHistoryTab()` fully replace `#sbC`'s innerHTML — including the input
  itself — on every filter change, so the DOM node the user was typing into was destroyed
  and recreated each time. Both now capture focus + cursor position before re-rendering and
  restore them after. `renderHistoryTab()` also skips its loading skeleton on refilters
  (only shown on first paint) and guards against a slower request overwriting a newer one.
- **Switching away to another browser tab and back reset the view to the Alerts tab**,
  discarding whatever tab (Stats/History/Updates/About) the user had actually been on.
  Caused by the 3.2.0 visibility-restore fix calling `renderSB()` unconditionally; `updUI()`
  now goes through `refreshCurrentTab()`, which only repaints the tab that's actually active.
- **Most tab and map-toolbar icons had no visible name on hover.** Only the Alerts tab had
  a text label; every other tab and every map-control button (home, locate, refresh, heatmap,
  cluster, shelters, satellite, clear) had `aria-label` for screen readers but no `title`, so
  hovering with a mouse showed nothing. Added matching `title` attributes throughout, plus
  `aria-label`/`tabindex` on the previously-unlabeled, unfocusable tab elements.

### Added
- **Satellite place-name labels.** Esri World Imagery (added in 3.3.0) has no text of its
  own; a free companion Esri overlay (place/road/border labels) can now be toggled on top of
  it via a new 🏷️ button that appears only while satellite mode is active.
- **Real Tel Aviv-Yafo shelter data.** Re-investigated shelter-data availability: the
  national data.gov.il catalog still has no open shelter dataset, but Tel Aviv-Yafo
  municipality publishes its own public GIS layer (~374 shelters with real addresses and
  fitness status). The server now proxies and caches it (`GET /api/shelters/tel-aviv`,
  refreshed at most daily) and the client merges it in automatically — replacing the two
  generic illustrative Tel Aviv points — whenever a deployer hasn't set their own
  `SHELTERS_URL`. Every other city remains explicitly illustrative; this doesn't change.
- A scrollable city picker (`<select>` listing every known city) next to the free-text
  search, for jumping the map straight to a city without typing.

## [3.3.0]

### Added
- **Rebranded to "Tzafir" (צפיר)** — the project's display name, PWA manifest,
  page title, and `package.json` (npm name: `tzafir`, formerly `israel-alert-map`).
  The GitHub repo itself is intentionally left as-is (`RedAlert`).
- **10 additional languages**: Amharic, Tigrinya, Thai, Tagalog, Ukrainian, French,
  Spanish, Romanian, Hindi, and Chinese — chosen for real communities in Israel
  (recent olim, foreign workers, and asylum seekers), bringing the total to 14.
  All languages share an identical key set. Amharic/Tigrinya translations are
  best-effort (lower-resource languages) and would benefit from native-speaker
  review before being relied on operationally. The language `<select>` is now
  generated dynamically from `lib.js`'s new `LANG_META` export instead of being
  hand-edited in `index.html`.
- **History tab** — a dedicated view backed by the full IndexedDB history (not
  just the capped in-memory list), with its own date range (today / yesterday /
  week / month / all) and city search.
- **Search by city** — a text filter alongside the existing region/type/time
  filters on the Alerts tab.
- **Updates tab** — an in-app changelog (mirroring this file) plus a one-time
  "what's new" popup shown to returning visitors after a version bump.
- **Satellite map layer** — a free toggle (Esri World Imagery, no API key)
  alongside the existing light/dark basemap, keeping the project's zero-key
  philosophy intact. (Real Google Maps was considered but requires a
  user-supplied API key + billing account, so it was intentionally not used.)
- **Digital clock** with seconds in the header (24h format).
- **Discord webhook** (`DISCORD_WEBHOOK_URL`) — posts an embed to a Discord
  channel for every new real alert batch, mirroring the existing health-webhook
  POST mechanics. No SDK; plain HTTPS POST, entirely optional.
- Patreon donation link now appears in every tab/menu (Alerts, Stats, History,
  Updates, and the Settings dialog footer), not just the About tab.

### Fixed
- **TTS announcer only ever read the last city in a multi-city alert batch.**
  `speak()` was called once per new alert inside a loop, and each call started
  by cancelling the in-progress utterance — so a burst of several simultaneous
  cities meant only the final one was ever audible. It now collects every new
  city in a batch and speaks them together in a single utterance.

## [3.2.0]

### Fixed
- **Connection indicator blinked forever, even when stably connected.** The status
  badge reused the same CSS class for both "connecting" and "connected" states, and
  both triggered an infinite pulse animation. The pulsing dot now only appears while
  genuinely connecting/reconnecting; once the SSE stream is confirmed open, the dot
  is steady.
- **The red alert banner kept blinking after the demo/test button was stopped.**
  Pressing stop only halted *scheduling new* demo alerts — alerts already created
  each had their own independent 90-second decay timer, so the banner (and the
  status-badge red pulse) could keep animating for up to 90 more seconds after
  "stop" was pressed. Stopping (or naturally finishing) the demo now immediately
  deactivates every demo-created alert.
- **Root cause behind stale/stuck UI in backgrounded tabs.** All DOM updates
  (banner, badge, alert list) were funneled through `requestAnimationFrame`, which
  browsers throttle or pause while a tab is hidden/backgrounded/minimized. If state
  changed while the tab wasn't visible (an alert ending, a demo being stopped), the
  DOM could stay stuck showing the old (blinking) state until something else forced
  a repaint. The app now forces a full UI resync the moment the tab becomes visible
  again, so nothing can be left showing a stale animated state.

### Added
- Pull-to-refresh gesture on the mobile bottom sheet (touch-only; wired to the
  existing manual-refresh action; respects `prefers-reduced-motion`).
- `CONTRIBUTING.md`, GitHub issue templates (bug report / feature request), and a
  pull request template.
- This changelog.

### Changed
- Expanded the illustrative default shelter samples from 12 to ~34, spanning all
  major regions, each explicitly labeled "(לדוגמה)" (example). Verified directly
  against data.gov.il's own API that no open, queryable public-shelter dataset
  exists there (0 results) — the defaults were always illustrative, and are now
  documented as such rather than implied to be authoritative. `SHELTERS_URL`
  remains the documented path for wiring up a real municipal shelter feed.

## [3.1.0]

### Added
- Fly.io deployment: `fly.toml` + `.github/workflows/deploy.yml` (auto-deploy on
  push to `main`, with a pre-deploy test gate and a post-deploy health smoke check).
- `lib.js` — single source of truth (UMD) for static data (`CITIES`, `LN`, `TM`,
  `RS`, `SHELTERS_DEFAULT`) and pure functions (`escapeHtml`, `formatShelter`,
  `shelterClass`, `distanceKm`, `isDND`, `normalizeCity`, `fuzzyMatch`). Loaded
  synchronously by the browser client and `require()`-d directly by `test.js` —
  eliminating a hand-maintained duplicate copy of these functions in the test file.
  Rewrote `test.js` on Node's built-in `node:test` runner.
- Server: alert history now snapshotted to disk (`.store-snapshot.json`, debounced
  writes + flush on `SIGTERM`) so a restart or redeploy no longer loses history.
- Server: detects when OREF's response shape becomes unrecognized 20 times in a row
  (possible upstream format change) and fires the health webhook instead of failing
  silently.
- Server: multi-URL fallback chain (`FALLBACK_ALERT_URLS`), OREF proxy caching for
  `/api/oref/*` (prevents accidental hammering of the upstream endpoint), bounded
  route-metrics map, debounced async subscriber persistence, exponential backoff on
  repeated OREF failures, `/api/v1/*` API versioning alias, and an OpenAPI 3.0.3 spec
  served at `/api/spec`.
- Client: Web Push subscription is now actually wired up end-to-end (VAPID subscribe
  + favorite-city/DND-aware filtering on the server) — previously the server-side
  Web Push machinery existed but the client never called it.
- Client: Wake Lock while an alert is active, per-alert-type vibration/sound
  profiles, a temporary snooze control, a confirmation prompt before clearing
  history, keyboard shortcuts, focus trap + `aria-modal` on the settings dialog,
  and offline caching of the Leaflet basemap tiles in the service worker.
- `SECURITY.md` (vulnerability disclosure, hardening checklist, intentional-design
  notes) and a bilingual Patreon donation card in the About panel.
- `SHELTERS_URL` environment variable to point the shelters layer at a real feed.

### Fixed
- **Alerts for cities without known coordinates were placed at a random point near
  the center of Israel** instead of being clearly marked as unlocated — misleading
  on a safety-oriented map. Such alerts now carry `noLoc: true`, are never given a
  map marker, and are labeled "unknown location" in the alert list.
- `/api/health` field names were inconsistent with what the test suite (and some
  integrations) expected (`uptime_s` → `uptime_seconds`, etc.).
- An OREF response of `200 OK` with an empty body (meaning: no active alerts) was
  miscounted as a failure, occasionally triggering a spurious fallback switch.
- Admin password no longer defaults to a hardcoded value (`admin123` / `changeme`);
  if `ADMIN_PASS` is unset, a strong random password is generated at boot and
  printed once to the logs.

## [3.0.0] — Initial release

- Node.js proxy server (zero core dependencies) + a monolithic HTML client
  displaying real-time Israeli Home Front Command (Pikud HaOref) alerts on a
  Leaflet map.
- Server-Sent Events streaming, REST API, optional Web Push, optional Telegram
  bot, PWA (installable, offline shell, service worker), 4-language i18n
  (he/en/ar/ru), Docker + docker-compose, admin dashboard with Basic auth,
  health-check webhook, rate limiting, and file-based alert logging with rotation.

[Unreleased]: https://github.com/DrummingBird1/RedAlert/compare/v3.4.0...HEAD
[3.4.0]: https://github.com/DrummingBird1/RedAlert/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/DrummingBird1/RedAlert/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/DrummingBird1/RedAlert/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/DrummingBird1/RedAlert/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/DrummingBird1/RedAlert/releases/tag/v3.0.0

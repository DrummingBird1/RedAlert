# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project uses [SemVer](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/DrummingBird1/RedAlert/compare/v3.2.0...HEAD
[3.2.0]: https://github.com/DrummingBird1/RedAlert/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/DrummingBird1/RedAlert/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/DrummingBird1/RedAlert/releases/tag/v3.0.0

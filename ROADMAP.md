# Roadmap — צפיר (Tzafir)

*מפת דרכים של הפרויקט. אין התחייבות לתאריכים.*

Direction of the project, in plain terms. No dates are promised; items move as time allows. Details of what shipped are in [CHANGELOG.md](CHANGELOG.md).

> Tzafir does not replace official Home Front Command (Pikud HaOref) instructions. Always follow them.

## Shipped (current: v1.6.5)

- **Map & UI** — live Leaflet map, satellite layer with place names, city search, filters by region / type / time, light and dark themes.
- **History** — long-term history in the browser (IndexedDB), timeline replay on the map, statistics tab, in-app changelog.
- **Languages** — 14 UI languages.
- **Delivery** — Server-Sent Events to the browser, optional Web Push, Discord webhook, a dependency-free Telegram bot, PWA with a service worker.
- **Shelters** — real shelter data for Tel Aviv-Yafo, Jerusalem and Haifa.
- **Reliability** — honest "no connection to the data source" state instead of a false "all clear", fallback alert sources, store snapshot that survives restarts.
- **Quality** — unit, integration and real-browser (Playwright) tests, plus a post-deploy smoke test that must pass before a release is tagged.

## In progress

- **Self-hosting for real alerts** — the data source only answers Israeli IP addresses, so the hosted demo cannot receive live alerts. Work is under way on a Docker setup (persistent data directory, Israel time zone) and a container-image workflow so it can run 24/7 from a home connection.
- **Translating the rescue instruction** — "get to a protected space now", the safe-room hint and the "I'm safe" button in all 14 languages.

## Planned

- **Full UI translation (v1.7.0)** — move the remaining hard-coded Hebrew (top counters, About tab, Settings, filter labels, statistics labels, connection status, iOS install hint) into the language dictionary, with a test that the English UI contains no Hebrew.
- **More alert types in the filter** — earthquake and tsunami.
- **Native-speaker review** of the Amharic and Tigrinya strings.
- **Dependency updates**, reviewed one at a time against CI.

## Ideas / later

- PNG icons for the PWA (iOS prefers PNG).
- Linting for `lib.js`, `scripts/` and the script inside `index.html`.
- Investigating why the data source's history endpoint returns an empty response.

## Not planned

- UI frameworks (React/Vue) in the client, or regular runtime dependencies in the core. The core stays dependency-free on purpose.

Ideas and bug reports are welcome as GitHub issues.

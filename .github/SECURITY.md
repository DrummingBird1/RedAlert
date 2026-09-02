# Security Policy

## ⚠️ Safety disclaimer first

This project is an **informational tool** and is **not a substitute for the official
alerts and instructions of the Israeli Home Front Command (Pikud HaOref)**. Never rely
on it as your sole source of alerts. Always follow official guidance.

## Supported versions

Only the latest release is supported. The project follows a rolling release on `main`;
fixes land there first. (Versions before 1.0.0 were numbered 3.0.0–3.6.0; renumbered
2026-08-30 — see [CHANGELOG.md](../CHANGELOG.md).)

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for an
exploitable vulnerability.

- Preferred: open a [GitHub Security Advisory](https://github.com/DrummingBird1/RedAlert/security/advisories/new)
  (Repository → Security → Report a vulnerability).
- Include: affected file/endpoint, reproduction steps, impact, and a suggested fix if you have one.

You can expect an initial response within a few days. There is no bug-bounty program;
this is a volunteer project.

## Deployment hardening checklist

The defaults are safe for local use; before exposing the server publicly:

- [ ] **Admin password** — set `ADMIN_PASS` to a strong value. If left unset the server
      generates a random password at boot and prints it once to the logs (it changes on
      every restart until you set it).
- [ ] **Admin 2FA** — set `ADMIN_TOTP_SECRET` (base32) to require a live 6-digit
      authenticator code alongside `ADMIN_PASS` for `/admin` and `/metrics`.
- [ ] **HTTPS** — terminate TLS via a reverse proxy (Caddy / nginx / Cloudflare). Required
      for Web Push and to protect the Basic-auth admin credentials in transit. See the README.
- [ ] **Rate limiting** — the built-in limiter is 120 req/min/IP; put a proxy/WAF in front
      for production-grade protection. Note it (and the admin audit log) trust the
      `X-Forwarded-For` header for the client IP — fine behind a real reverse proxy that sets
      it, but spoofable if the raw Node process is exposed directly to the internet.
- [ ] **Secrets** — `.vapid-keys.json`, `.push-subs.json`, and `.store-snapshot.json` are
      git-ignored. Never commit them. Use `flyctl secrets` / env vars for credentials.

## Intentional design decisions (not vulnerabilities)

These are deliberate and **should not be reported** as bugs:

- **Open CORS (`Access-Control-Allow-Origin: *`)** — the read API is meant for public
  consumption (embeds, third-party dashboards).
- **CSP allows `'unsafe-inline'`** — the client is a single monolithic HTML file with
  inline CSS/JS by design.
- **No authentication on read endpoints** (`/api/alerts`, `/api/stream`, `/api/logs`, etc.) —
  the data is public alert information; only `/admin` and `/api/admin/*` require credentials.
  `/api/logs` serves `logs/alerts.log`, which contains nothing beyond what `/api/alerts` and
  `/api/history` already expose publicly.
- **`POST /api/client-error` is unauthenticated by design** — it's a public error-reporting
  sink, gated only by the global rate limiter. It's self-limiting (rotated at 10MB × 5 files),
  so the worst case is old genuine error reports getting rotated out faster under abuse, not
  unbounded disk growth.

## Dependabot alerts

GitHub reported 8 alerts (1 critical, 2 high, 5 moderate) the first time
`pnpm-lock.yaml` was committed — Dependabot can only scan a lockfile once it's
tracked in git, so this was a first-visibility event, not a new regression.

- **7 of 8 (`request`, `form-data` ×2 including the critical one, `qs` ×2,
  `uuid`, `tough-cookie`)** all traced to the same chain: the deprecated
  `request`/`@cypress/request` HTTP client pulled in transitively by
  `node-telegram-bot-api@0.66.0` (an `optionalDependency`, used only by the
  standalone `telegram-bot.js`). That library's only actual use in this repo
  was `new TelegramBot(token, {polling:false})` + `bot.sendMessage(...)` — a
  single Telegram Bot API call. **Fixed**: `telegram-bot.js` was rewritten to
  POST to `api.telegram.org` directly via `https` (same pattern as
  `sendDiscord()` in `server.js`), and `node-telegram-bot-api` was dropped
  from `package.json` entirely. This removes the whole vulnerable chain and
  needs no `npm install` step anymore.
- **1 of 8 (`js-yaml`, high, quadratic-CPU DoS in `!!omap` parsing)** comes
  from `eslint@9.39.5` → `@eslint/eslintrc` (a `devDependency`, only runs
  locally/in CI, never in the deployed server). The project never parses
  untrusted YAML anywhere in `server.js`/`index.html`/`lib.js` — the only YAML
  file is the static, developer-authored `openapi.yaml`, which is served as-is
  and never fed through `js-yaml`. **Accepted, not fixed**: eslint only drops
  this dependency in its v10 line, which requires migrating `.eslintrc.json`
  to flat config (`eslint.config.js`) and raising the supported Node version
  to `^20.19 || ^22.13 || >=24` (the project currently declares
  `engines.node: >=18`) — out of proportion to a lint-only, non-exploitable
  advisory. Revisit if/when the project bumps its minimum Node version.

## Data & privacy

- The server stores only alert data (city, type, timestamp) — **no user accounts, no PII**.
- Web Push subscriptions (`.push-subs.json`) contain browser endpoints + chosen favorite
  cities; they never leave your server.
- Client preferences (language, theme, favorites, DND) live in the browser's
  `localStorage` / `IndexedDB` and are never transmitted except as Web Push favorites.
- `logs/admin-audit.log` records every `/admin`/`/metrics` auth attempt (timestamp, success/
  failure, IP, path) — never served over HTTP, file-system access only.
- `logs/client-errors.log` records client-reported JS errors (message, stack trace, page URL,
  User-Agent) — also file-system access only, never served over HTTP.
- Git commit history uses only the GitHub-provided `users.noreply.github.com` address, never
  a personal email.

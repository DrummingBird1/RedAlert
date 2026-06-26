# Security Policy

## ⚠️ Safety disclaimer first

This project is an **informational tool** and is **not a substitute for the official
alerts and instructions of the Israeli Home Front Command (Pikud HaOref)**. Never rely
on it as your sole source of alerts. Always follow official guidance.

## Supported versions

| Version | Supported |
|---------|-----------|
| 3.1.x   | ✅        |
| 3.0.x   | ✅        |
| < 3.0   | ❌        |

The project follows a rolling release on `main`; fixes land there first.

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
- [ ] **HTTPS** — terminate TLS via a reverse proxy (Caddy / nginx / Cloudflare). Required
      for Web Push and to protect the Basic-auth admin credentials in transit. See the README.
- [ ] **Rate limiting** — the built-in limiter is 120 req/min/IP; put a proxy/WAF in front
      for production-grade protection.
- [ ] **Secrets** — `.vapid-keys.json`, `.push-subs.json`, and `.store-snapshot.json` are
      git-ignored. Never commit them. Use `flyctl secrets` / env vars for credentials.

## Intentional design decisions (not vulnerabilities)

These are deliberate and **should not be reported** as bugs:

- **Open CORS (`Access-Control-Allow-Origin: *`)** — the read API is meant for public
  consumption (embeds, third-party dashboards).
- **CSP allows `'unsafe-inline'`** — the client is a single monolithic HTML file with
  inline CSS/JS by design.
- **No authentication on read endpoints** (`/api/alerts`, `/api/stream`, etc.) — the data
  is public alert information; only `/admin` and `/api/admin/*` require credentials.

## Data & privacy

- The server stores only alert data (city, type, timestamp) — **no user accounts, no PII**.
- Web Push subscriptions (`.push-subs.json`) contain browser endpoints + chosen favorite
  cities; they never leave your server.
- Client preferences (language, theme, favorites, DND) live in the browser's
  `localStorage` / `IndexedDB` and are never transmitted except as Web Push favorites.

# Contributing

Thanks for considering a contribution to `israel-alert-map`. This is a small, volunteer,
zero-core-dependency project — the goal is to keep it that way. Please read
[SECURITY.md](SECURITY.md) first if you're reporting a vulnerability (privately, not
as a public issue).

## Before you start

- **Safety disclaimer**: this project is informational only and is not a substitute for
  official Home Front Command (Pikud HaOref) alerts and instructions. Keep that framing
  in any user-facing text you add.
- **Zero core dependencies** — `server.js` must keep working with nothing installed
  (`web-push` and `node-telegram-bot-api` are optional; every feature that uses them
  must degrade gracefully when they're absent).
- **No client framework** — `index.html` is a deliberately monolithic HTML+CSS+JS file
  using plain DOM APIs. Please don't introduce React/Vue/build tooling.
- For the full architecture picture (file layout, how SSE/Web Push/fallback work, style
  conventions), read [CLAUDE.md](CLAUDE.md) — it's the same guide used to work on this
  codebase with AI coding assistants, and it's kept up to date with the actual code.

## Dev setup

```bash
git clone https://github.com/DrummingBird1/RedAlert.git
cd RedAlert
node server.js          # → http://localhost:3000, no npm install needed
```

Optional extras:

```bash
npm install              # web-push + node-telegram-bot-api (both optional)
ADMIN_PASS=devpass node server.js
```

## Running tests

```bash
node test.js               # unit tests (node:test) — pure functions in lib.js
node test-integration.js   # E2E — spins up a mock OREF server + the real server
npm run test:all           # both, sequentially
npm run lint                # ESLint (npm i -D eslint first — it's a devDependency)
```

Both test files must pass before opening a PR. There's no build step and no
typecheck — the project intentionally has no toolchain beyond Node itself.

## Code style

- **Language**: UI strings and comments in Hebrew; variable/function names in English.
- **Density**: this project prefers long, dense one-liners over vertically spaced code.
  When editing an *existing* region, match its style. New, clearly-separate regions can
  be more spaced out — use your judgment, but don't rewrite surrounding code just to
  "clean it up."
- **Security**: any string from the user or from OREF that gets inserted into HTML
  **must** go through `escapeHtml()` (aliased as `X()` in the client) — see `lib.js`.
- **Single source of truth**: static data (cities, i18n strings, alert types, shelter
  samples) and the small set of pure helper functions live in `lib.js` (UMD — used by
  both the browser client and `test.js`). Don't duplicate them elsewhere.

## Submitting a change

1. Fork the repo, create a branch off `main`.
2. Make your change, keeping the scope focused — one logical change per PR is easier
   to review than a bundle of unrelated fixes.
3. Run both test suites (see above) and add/update tests in `test.js` if you touched a
   pure function in `lib.js`.
4. Update `CLAUDE.md` / `AGENTS.md` / `README.md` if your change affects documented
   behavior (env vars, endpoints, architecture notes) — stale docs are worse than no docs.
5. Open a PR using the template; describe *why*, not just *what*.

## Reporting bugs / requesting features

Use the issue templates (`.github/ISSUE_TEMPLATE/`) — they'll guide you through the
right level of detail. For anything exploitable, see [SECURITY.md](SECURITY.md) instead.

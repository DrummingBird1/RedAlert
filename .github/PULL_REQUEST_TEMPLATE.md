## What does this PR do?

<!-- One or two sentences. Link an issue if there is one: Fixes #123 -->

## Why?

<!-- The motivation — what was broken, missing, or annoying before this? -->

## How was this tested?

- [ ] `node test.js` passes (unit tests)
- [ ] `node test-integration.js` passes (mock OREF → server → SSE)
- [ ] Manually tested in a browser (describe what you clicked/checked)
- [ ] N/A — docs-only change

## Checklist

- [ ] Follows the style conventions in [CLAUDE.md](../CLAUDE.md) (dense one-liners in existing regions, Hebrew UI strings / English identifiers, no new client-side framework)
- [ ] No hardcoded secrets, tokens, or personal data
- [ ] Server changes still work with **zero** optional dependencies installed (`web-push`, `node-telegram-bot-api` absent)
- [ ] Updated `CLAUDE.md` / `AGENTS.md` / `README.md` if this changes documented behavior

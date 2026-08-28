---
name: project-wiki-qa-neo-backend-2026-08-27
description: "Wiki browser-QA gained a BrowserOS Neo backend; PR #6 open, live-audit GitHub-chrome false positives left for next session."
metadata: 
  node_type: memory
  type: project
  originSessionId: dda3f29b-6957-4b35-89b6-6333d2a32693
  modified: 2026-08-27T14:26:41.858Z
---

`tools/wiki-browser-qa/` now has a selectable browser backend: `gstack` (default, blocked here — `browse.exe` absent) and `neo` (BrowserOS Neo via MCP `http://127.0.0.1:9010/mcp`, `run` tool + CDP viewport emulation). Select with `WIKI_QA_BROWSER_BACKEND=neo` or `--backend=neo` or `npm run wiki:qa:neo`.

Shipped on branch `codex/torqquery-hybrid-agent-dispatch`, commit `3b0c604`, in **PR #6 → main (OPEN, not merged)**. 57 tests pass / 0 skip. Live audit report at `.artifacts/wiki-qa/report.json` (now gitignored).

**Next session** (full handoff: `<scratchpad>/wiki-qa-neo-handoff.md` — copy out before it's cleared):
1. Merge PR #6.
2. Fix live-audit GitHub-chrome false positives (7/16 fails, all refinement): scope heading/title/link collection to the wiki content container instead of whole document (GitHub repo-header injects hidden `<h1>`; app-route links 4xx on credentials-omitted fetch); update `diagram-policy.json` selectors to match GitHub's rendered DOM for `toolforge-architecture-overview`.
3. Optional: stabilise Neo fixture-test wall-time (share one adapter/session across the 3 tests).

Do not force-push `main` — `origin/main` is PR-based (#3/#4/#5 already merged from this branch). Pre-push hook auto-adds a `docs(wiki): synchronize...` sync commit (`a136cb0`), unrelated, rides along in PR #6.

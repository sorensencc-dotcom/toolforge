---
name: finding-ijfw-fts5-missing-dep-fixed-2026-07-26
description: "better-sqlite3 was missing from ijfw mcp-server, silently broke tier-promotion + wiki-compile for 6+ weeks; installed and verified fixed"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0a494a8b-02a6-43ca-9ef9-72788e831d5a
  modified: 2026-07-26T14:12:58.437Z
---

`better-sqlite3` was absent from `node_modules` in `C:\Users\soren\.ijfw\mcp-server` despite being a declared dependency in package.json. `fts5.js` (memory tier-promotion, long-term wiki compile) failed to load silently — dream-state logs since 2026-06-14 showed those stages permanently skipped but summaries reported `completed=5 failed=0`, masking the breakage.

**Why:** Dependency was never installed (likely npm install skipped on that machine/session), not a code bug. `npm install` in that dir pulled it in cleanly on first try.

**How to apply:** Fixed 2026-07-26 — ran `npm install`, verified both `require('better-sqlite3')` and `require(fts5.js)` load without error. If dream-state logs show tier-promotion/wiki-compile skipped again, check `node_modules/better-sqlite3` exists before assuming a code regression — this exact failure mode is silent and easy to miss behind `failed=0` summaries.

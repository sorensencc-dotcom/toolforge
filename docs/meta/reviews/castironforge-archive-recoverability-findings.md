# castironforge Archive — Recoverability Findings

Date: 2026-09-26

## What's tracked

- Git-tracked files under `docs/archive/projects/castironforge/`: **0**
  (verified: `git ls-files docs/archive/projects/castironforge | wc -l` → `0`)
- Commit history for this path (any point, any branch): **none — never committed**
  (verified: `git log --all --diff-filter=A -- 'docs/archive/projects/castironforge/*'`
  produced no output)

## What else exists

`castironforge` is not an orphaned one-off. Two other locations exist (verified via
`find /c/dev -maxdepth 3 -iname "*castironforge*" -not -path "*/docs/archive/*"`):

```
/c/dev/rewrite-docs/castironforge
/c/dev/rewrite-docs/castironforge/castironforge.code-workspace
/c/dev/rewrite-mcp/castironforge
```

- `/c/dev/rewrite-docs/castironforge/` — contains `cic-ingestion` (same project name as the
  archive), plus a workspace file and additional structure not present in the archive copy.
- `/c/dev/rewrite-mcp/castironforge/` — a further location for the same project family, also
  containing `cic-ingestion`.

Within the archive itself, the three sub-projects are not equally significant:

- `chat-agent/` and `chat-frontend/` under the archive contain **only `node_modules`** — no
  source code, no top-level `package.json`. Verified via:
  - `find /c/dev/docs/archive/projects/castironforge/chat-agent -maxdepth 2 -not -path "*/node_modules*"`
    → returns only the directory itself (`/c/dev/docs/archive/projects/castironforge/chat-agent`)
  - `find /c/dev/docs/archive/projects/castironforge/chat-frontend -maxdepth 2 -not -path "*/node_modules*"`
    → returns only the directory itself (`/c/dev/docs/archive/projects/castironforge/chat-frontend`)

  These two are husks; there is no unique content to lose here regardless of what's found
  elsewhere.
- `cic-ingestion/` under the archive **does** have full source, docs, tests, and build
  artifacts (`dist/`) — this is the one sub-project worth comparing carefully.

## cic-ingestion version comparison

`docs/archive/projects/castironforge/cic-ingestion/package.json` vs
`rewrite-docs/castironforge/cic-ingestion/package.json`:

```
< "version": "0.1.0"
---
> "version": "0.26.0"
```

Full verified diff also shows the two are structurally different projects at this point, not
just a version bump: different `main` entry point (`dist/src/autonomy/AutonomyAPIServer.js` vs
`src/index.js`), different build/test scripts, and substantially different dependency sets
(archive uses `@anthropic-ai/sdk`, `better-sqlite3`, `cloakbrowser`, `puppeteer`, `express`;
rewrite-docs copy drops all of those and adds `node-cron`). The rewrite-docs copy pins exact
dependency versions (no `^` ranges) where the archive uses caret ranges.

This indicates the archived `cic-ingestion` is an **older snapshot** of a project that continued
developing under `rewrite-docs/castironforge/` (and exists again, further along, under
`rewrite-mcp/castironforge/`). It is not a unique, isolated artifact — it's superseded history
of a project whose current state lives elsewhere. Note: only `package.json` was diffed here; a
full `src/`-level diff was not performed (see Recommendation below).

## Recommendation for Tier 1

This is **not** "the only copy, handle with extreme care" — it's a superseded snapshot of a
project that kept evolving under `rewrite-docs/` and `rewrite-mcp/`. That changes the risk
calculus but does not remove the git-tracking gap: it is still 100% untracked by git in its
current location, so even "delete a superseded snapshot" should not happen inside an agent
session without a human confirming the newer copies really do supersede it (a full diff of
`cic-ingestion`'s `src/` between the archive and `rewrite-docs` copy was NOT done here — only
`package.json` was compared). Recommend:

1. Tier 1 (or whoever owns `rewrite-docs`/`rewrite-mcp`) confirms `rewrite-docs/castironforge/
   cic-ingestion` and/or `rewrite-mcp/castironforge/cic-ingestion` are the live/current version
   and the archive copy has nothing unique.
2. `chat-agent/` and `chat-frontend/` (node_modules-only, no source) can be deleted with no
   real investigation needed once (1) is confirmed for the sibling `cic-ingestion/` directory —
   they carry no unique content under any scenario.
3. Do not delete anything in this session — this doc is evidence for that decision, not the
   decision itself.

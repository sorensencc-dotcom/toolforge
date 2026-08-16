---
name: learning-sync-hook-fail-fast-and-session-search
description: "Two process learnings from building TODOS.md<->drift/retro sync tooling — hooks should block fake-passing commits, session transcripts are searchable"
metadata: 
  node_type: memory
  type: project
  originSessionId: b46b5f23-d0b0-4c32-8159-bdd3fdd4d1fc
  modified: 2026-08-09T14:41:35.961Z
---

Sync hook only good as what it's allowed to silently fix — retro-schema failure was right kind of catch: hook blocked fake-passing commit instead of human noticing missing fields by hand.

Session-transcript search (find-session.ps1) turns "my VSCode tab didn't reopen" from data-loss scare into one-command lookup — transcripts already persist independent of UI state, gap was discoverability, not durability.

**Why:** backfilled from `.context/retros/2026-07-31-1.json:64-66` — flagged by weekly audit as never having reached memory/MEMORY.md despite CLAUDE.md's "learnings feed forward via /learn" claim.

**How to apply:** when building sync/validation hooks, prefer fail-loud over silent-patch. When "can't find a past session" comes up, check for a transcript-search tool before assuming data loss.

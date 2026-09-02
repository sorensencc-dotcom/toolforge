---
name: project-preflight-underlying-scripts-broken-2026-07-23
description: pre-flight script wired everywhere but underlying scripts it calls were already broken before this session
metadata: 
  node_type: memory
  type: project
  originSessionId: c5a49bff-90b1-4e83-9192-f5a883ddad79
  modified: 2026-07-24T02:50:00.010Z
---

pre-flight wired repo-wide, but scripts it invokes were already broken pre-session: no eslint config, pre-existing failing tests, missing file. Flagged in commit messages this session, not fixed yet.

**Why:** discovered while wiring pre-flight; root causes predate this session's changes, out of scope to fix inline.

**How to apply:** next session, fix underlying scripts (add eslint config, fix failing tests, restore missing file) so pre-flight gate actually passes clean.

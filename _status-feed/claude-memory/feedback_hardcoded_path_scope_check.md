---
name: feedback_hardcoded_path_scope_check
description: "When fixing a hardcoded absolute path bug in toolforge scripts, grep repo-wide before closing the fix"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4273f35c-4ab5-478e-8e9b-57bf3f30e162
---

When fixing a hardcoded absolute-path bug (e.g. `TOOLFORGE_ROOT` pointing at the wrong dir), grep the literal string repo-wide before treating the fix as done.

**Why:** the `run-tool.ps1` `TOOLFORGE_ROOT` fix (2026-07-17, see [[session-wrap-2026-07-17-skill-migration-runtool-repair]]) patched one script. Later the same day, [[session-wrap-2026-07-17-dual-clone-collapse]] found the identical bug in **26 other `.ps1` files** — never caught because nobody grepped repo-wide after the first fix. Two separate sessions had to rediscover the same root cause.

**How to apply:** any time a hardcoded absolute path (repo root, install dir, tool root) is found broken in one script, immediately run `grep -rl '<literal-path>'` across the repo before calling the fix complete. Treat a single hardcoded-path bug as a signal to check for the pattern, not an isolated incident.

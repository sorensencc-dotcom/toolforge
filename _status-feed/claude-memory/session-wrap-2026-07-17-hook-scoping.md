---
name: session-wrap-2026-07-17-hook-scoping
description: "Scoped pre-commit/pre-push git hooks to changed files, cutting session-wrap hook time; fixed via source-of-truth generator, not the installed hook file."
metadata: 
  node_type: memory
  type: project
  originSessionId: f331c20b-5904-416f-970d-20cf06301818
---

Pre-commit validator (`ci-pipeline.ps1 -Stage validator`) ran on every commit regardless of scope, and pre-push security audit scanned all 40+ skill dirs on every push regardless of what changed — the two biggest costs in slow session-wraps, per user complaint. Fixed both in `setup-git-hooks.ps1` (the generator — installed `.git/hooks/*` are auto-generated and say "do not edit" for real, see [[learning-hooks-generator-source-of-truth]]):
- pre-commit: skip validator entirely if no staged files touch `skills/` or `utilities/`.
- pre-push: scope auditor to skill dirs changed vs upstream (`git diff @{u}...HEAD`), full-scan fallback when there's no upstream.

Regenerated hooks via `-Action Install`, verified both live, committed (`a75aea1`) and pushed.

**Why:** User flagged session-wrap taking "an awfully long time" and asked what to fix next session — this was addressed same-session instead of deferred.

**How to apply:** If session-wrap/hook latency comes up again, these two hooks are already scoped — look elsewhere (skill preamble overhead, /retro data-gather parallelism) per the original diagnosis.

Also surfaced (not a bug, but worth knowing): a background daemon (cowork-auto-sync or similar) regenerates several tracked report files live during a session, which can make `git stash` look like it silently failed to restore content — see [[learning-cowork-daemon-live-regen]].

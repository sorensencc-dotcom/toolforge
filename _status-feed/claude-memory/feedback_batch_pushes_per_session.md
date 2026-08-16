---
name: feedback_batch_pushes_per_session
description: "Batch all commits into one push per session/wrap instead of pushing after each commit, to avoid racing toolforge-release-bot's per-push CI trigger."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f331c20b-5904-416f-970d-20cf06301818
---

`toolforge-release.yml` triggers on every push to `main` (except docs/md-only), and pushes a `chore(release):` commit back within seconds. Pushing more than once per session guarantees a non-fast-forward rejection on the second push, forcing a stash/rebase/verify dance each time.

**Why:** 2026-07-17 hook-scoping session pushed twice (hook fix, then retro snapshot) and hit the race both times — user called out the session as "not any faster" despite the hook-runtime fix actually working. The bottleneck was self-inflicted push cadence, not hook latency. User explicitly chose not to change the CI trigger (docs/AskUserQuestion 2026-07-17) — this is the agreed fix.

**How to apply:** Commit freely during a session, but hold the `git push` until the very end (or until the user explicitly asks to push mid-session). One push per session avoids the race entirely. If a rebase is still needed (someone else pushed), prefer `git checkout -- <file>` over `git stash` for files known to be daemon-regenerated noise ([[learning-cowork-daemon-live-regen]]) rather than the stash/verify/drop cycle.

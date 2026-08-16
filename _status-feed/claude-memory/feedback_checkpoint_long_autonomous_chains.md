---
name: checkpoint_long_autonomous_chains
description: Break up long-running waits and multi-step autonomous work with checkpoints instead of running to completion unattended
metadata:
  node_type: memory
  type: feedback
  originSessionId: ef08b674-69ce-49c1-9b0d-80187a2a3f0d
  modified: 2026-08-14T03:50:21.213Z
---

**Rule:** Don't chain long blocking waits or large multi-step autonomous work end-to-end without a checkpoint. Two distinct failure modes, both burn tokens/turns the user didn't sign up for:

1. **Blocking-wait chaining.** Using `TaskOutput` with long (~600s) blocks repeatedly in a row when a background task is slow, instead of reaching for `ScheduleWakeup` after the first attempt or two. `ScheduleWakeup` frees the turn and lets the user redirect; repeated `TaskOutput` blocks don't.
2. **Unbroken high-blast-radius chains.** Once given scope approval for a task (e.g. "fix root cause + clean up"), running the entire remaining sequence — code fix, tests, large deletions, commits, pushes to origin, memory writes — as one continuous unattended run. Even with approval for the *scope*, actions with real blast radius (rewriting shipped code, deleting gigabytes of tracked history, pushing to a remote) deserve a mid-chain checkpoint, not just an initial go-ahead.

**Why:** 2026-08-14 session — user called out both patterns after a session that (a) blocked on `TaskOutput` for 25-45+ min stretches multiple times waiting on slow `trm ingest-notebooklm` runs instead of scheduling a wakeup, and (b) ran the full staging-dir bug fix (patch → test → build → 16GB deletion across two repos → corrective commit → push to origin → memory updates) as one unbroken chain after a single upfront scope approval via AskUserQuestion. User's words: "we also had some long sessions you took on some stuff and did not stop probably burned more tokens then we should have we're supposed to break it up."

**How to apply:**
- If a background task doesn't return within one `TaskOutput` block (or two, generously), switch to `ScheduleWakeup` — don't just re-issue another long block.
- After getting scope approval for a multi-step task, still checkpoint before the highest-blast-radius step in the chain (large deletions, force-pushes, rewriting code that ships, anything hard to reverse) — a quick "found X, about to do Y, proceeding" is cheap; an unbroken hour of unattended action is not what "approved" meant.
- This is separate from [[feedback_reduce_prompts]] (which says don't over-ask on low-stakes calls) — this is about pacing/checkpointing genuinely large or slow chains, not about asking permission for routine steps.

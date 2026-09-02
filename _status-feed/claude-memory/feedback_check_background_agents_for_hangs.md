---
name: feedback-check-background-agents-for-hangs
description: "Proactively check background agents for stalls instead of passively waiting on completion notifications -- confirmed as a repeat problem, not a one-off."
metadata: 
  node_type: memory
  type: feedback
  modified: 2026-07-25T13:37:44.099Z
  originSessionId: 1a4b024e-1309-431a-9262-f57816a83582
---

Background agents can hang silently (status stays "running", output file stays
0 bytes) with no notification ever firing. User confirmed this is not the
first time it's happened and called it out as a pattern to fix, not an
isolated incident.

**Why:** during the MFM photo-review batch
([[project-trm-ingest-scale-problem-2026-07-25]]), 3 of 4 parallel batches
(same size, same prompt shape) finished in 30-45 min. The 4th sat at 0 bytes
output for 9+ hours still reporting status "running" -- confirmed hung, not
slow, once checked. User had to ask "did the machine shut off" before this
got investigated; it should have been caught much earlier on its own.

**How to apply:** when running multiple same-shape background agents/tasks in
parallel (or any single long one with sibling timing data), proactively poll
with `TaskOutput task_id=<id> block:false` once elapsed time passes roughly
2x what comparable siblings took (or 2x a reasonable estimate if no
siblings). Don't wait passively for a completion notification that a hung
task will never send. If status is "running" but the output file is
untouched/empty well past the expected window, treat it as hung: stop it
(`TaskStop`) and relaunch rather than continuing to wait.

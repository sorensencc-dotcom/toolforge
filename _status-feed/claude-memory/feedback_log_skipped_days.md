---
name: feedback-log-skipped-days
description: "When a workday is skipped, note why in a commit or ~/.gstack/retro-context.md entry"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1d68638d-4b8e-4798-82c3-aa1e218ff89b
  modified: 2026-08-12T03:03:59.824Z
---

If a day gets skipped (no commits/session), note why — quick commit message or `~/.gstack/retro-context.md` entry.

**Why:** Retro 2026-08-11 flagged Aug 7 as an unexplained streak break — "streak broke" reads as a mystery instead of a data point without a reason logged.

**How to apply:** On resuming after a skipped day, add a one-line reason (illness, travel, deliberate break, blocked on X) to `~/.gstack/retro-context.md` or the next commit message, so retro tooling can distinguish signal from noise.

---
name: session_continuity_gap
description: "2026-07-12 had 3 commit drops with 3+ hr gaps, no linking note between them — continuity risk for multi-drop sessions"
metadata: 
  node_type: memory
  type: project
  originSessionId: 77d54c09-1b77-4d8b-b6fa-44351f19c78d
---

07-12 evening: three commit drops, 3+ hour gaps between each, same evening, no note linking them.

**Why:** without a "next: X" pointer, resuming after a gap means re-deriving what the next drop was supposed to do — costs time/context that a one-liner would've saved.

**How to apply:** when a session produces multiple commit drops with hour+ gaps, put one-line "next: X" in the last commit message of each burst. Relates to [[retro_lockfile_loc_exclusion]] (same 07-12 retro).

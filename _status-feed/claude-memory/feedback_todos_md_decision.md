---
name: feedback_todos_md_decision
description: "TODOS.md created at c:\\dev root 2026-07-15 — reverses earlier \"memory-only backlog\" decision"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: de2ca311-9be7-4aba-9bcb-4e4a5a671e02
---

c:\dev\TODOS.md now exists — repo-root backlog file with Open/Process/Log sections, linking to memory files for rationale rather than duplicating it.

**Why:** earlier decision (same day, prior session) was to keep backlog memory-only and skip TODOS.md, since retro tolerates its absence. That decision recurred as a flagged gap in two separate retros (07-12, 07-15) — a recurring flag on a "settled" decision means the decision wasn't actually settling anything. User chose to create the file rather than re-defer a third time.

**How to apply:** treat TODOS.md as live going forward — update its Open section when scope changes, don't let it silently go stale (same failure mode as CHANGELOG.md, see [[changelog_discipline_gap]]). Memory still holds the *why* behind each item; TODOS.md holds the *what's outstanding* at a glance.

---
name: feedback-commit-chore-sync-tag
description: "Bulk/automated resync commits (e.g. .ijfw state) get chore(sync): prefix, separate from authored work"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ce635f64-469e-4944-83df-477f3168ba39
  modified: 2026-07-29T16:38:05.818Z
---

Bulk/automated resync or session-state commits (e.g. large `.ijfw/` regen touching hundreds of files) → `chore(sync):` prefix, distinct from authored work.

**Why:** Retro 2026-07-29 found a 506-file session-state resync ate half that week's raw LOC total, distorting every LOC/commit-type metric without hand-auditing shortstat output.

**How to apply:** Before committing a large auto-generated/resync change set, tag it `chore(sync):` instead of folding it into a regular `chore:`/`fix:` commit. Lets retro tooling filter these out programmatically. Documented in [CLAUDE.md](../../../../dev/CLAUDE.md) Productivity Discipline item 5.

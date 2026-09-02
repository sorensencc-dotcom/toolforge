---
name: feedback-retro-memory-triage-lesson
description: "How to handle pasted retro/meeting output with no explicit verb, without duplicating existing memory"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1d68638d-4b8e-4798-82c3-aa1e218ff89b
  modified: 2026-08-12T03:08:25.733Z
---

Retro/meeting-output pastes ("here's my retro findings") often restate a habit already memorized. Diff against existing memory before writing new files — don't assume new paste = new memory.

**Why:** 2026-08-11 retro-triage task nearly duplicated [[feedback_commit_chore_sync_tag]] until existing file was checked first. Drift risk: same lesson re-saved under a new name each time it resurfaces in a retro, fragmenting the index instead of reinforcing one entry.

**How to apply:**
1. Grep MEMORY.md / related slugs before creating a new feedback/project memory from retro output.
2. If a paste has no explicit imperative (save? act? discard?), ask one single-select question to disambiguate scope rather than guessing — don't silently save everything.
3. Don't restate what's already codified in CLAUDE.md governance — only add a memory pointer for genuinely new increments.
4. Memory writes: frontmatter (name/description/type) + body (rule → **Why:** → **How to apply:**), cross-link via `[[slug]]`, update MEMORY.md index same turn.

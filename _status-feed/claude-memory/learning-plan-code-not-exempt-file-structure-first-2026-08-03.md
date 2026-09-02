---
name: learning-plan-code-not-exempt-file-structure-first
description: "Plan-embedded reference code can carry the same bugs it's meant to prevent; read file structure before locking task boundaries"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b46b5f23-d0b0-4c32-8159-bdd3fdd4d1fc
  modified: 2026-08-09T14:41:41.660Z
---

Plan-embedded reference code is not exempt from scrutiny: all 3 of a final review's highest-severity findings (resumability inversion, dead dedup flag, one HEIC misclassification path) were present verbatim in the plan document's own example code. Every task-scoped review passed because each task's tests were also copied from the same plan — plan supplied both the bug and the test that failed to catch it. Task-scoped review verifies "matches the brief"; only a broad final review, read fresh against design intent rather than the brief's literal text, caught the brief itself was wrong.

File-structure mapping during plan-writing (not just implementation) is where real reuse surfaces: reading ingestDir.ts and classify.ts before finalizing a vision-classifier design revealed a documented, signature-stable placeholder built for exactly that purpose, cutting the plan from "new endpoint + new module" to "fill in existing extension point."

**Why:** backfilled from `.context/retros/2026-08-03-1.json:54-56` — flagged by weekly audit as never having reached memory/MEMORY.md.

**How to apply:** (1) don't skip scrutiny of code blocks inside a plan doc just because they're "the spec" — review them like any other code at final-review time, with fresh eyes against intent, not just against the brief. (2) before locking task boundaries in a new plan, do a file-structure read-through of the target area first — look for existing extension points before designing new ones.

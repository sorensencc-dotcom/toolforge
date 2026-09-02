---
name: feedback-frontload-plan-review
description: "Run adversarial review (/plan-eng-review) on plan docs before first commit, not after 8 revisions"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1d68638d-4b8e-4798-82c3-aa1e218ff89b
  modified: 2026-08-12T03:03:35.987Z
---

Run adversarial review on plan docs as first pass, not after multiple patch-and-recheck rounds.

**Why:** Compactor plan got audited into shape only after 8 revisions; same rigor as an initial pass (via `/plan-eng-review`) would've turned 8 commits into 2-3. Flagged in retro 2026-08-11 covering the prior work window.

**How to apply:** When drafting a plan doc, run `/plan-eng-review` (or equivalent adversarial review skill) before committing the initial draft. Trigger rule: if a plan doc hits its 3rd revision in one sitting, stop and run the review skill before continuing — cheaper than more patch-and-recheck rounds. See [[feedback_commit_chore_sync_tag]] for related metrics-hygiene habit.

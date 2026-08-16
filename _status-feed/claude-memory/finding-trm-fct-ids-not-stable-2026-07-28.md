---
name: finding-trm-fct-ids-not-stable-2026-07-28
description: "trm extract.json FCT-### ids are positionally renumbered on every regen, not stable identifiers — caught during sync-treatment skill design before any code was written"
metadata: 
  node_type: memory
  type: project
  originSessionId: d606102f-397d-4ccc-a80b-ccf2dca4143a
  modified: 2026-07-29T01:36:09.138Z
---

`trm/src/core/regenerateExtractJson.ts:32-35` renumbers every fact's `id`
(`FCT-${i+1}`) from scratch on each regen, based on merged-array position.
Any design that diffs/tracks facts by `FCT-###` across runs is broken —
reordering, adding, or removing an upstream fact silently reshuffles every
id after it.

Caught during [[2026-07-28-trm-sync-treatment-design]] brainstorming, in a
second caveman-review pass (external reviewer flagged "cursor identity is
unstable" as a hypothesis; verified against actual code before accepting
the fix, per [[feedback_verify_fix_by_running_not_reading]] discipline —
read the regen source directly instead of trusting the review claim).

Fix adopted in the design: content-hash `factKey = sha256(source_id + "|" +
normalize(text))`, computed fresh from `extract.json` on every run, never
persisted as vault content. Any future code touching TRM facts
cross-session (not just the sync-treatment skill) should use this pattern,
not `FCT-###`, if it needs to recognize "the same fact" across two
different `extract.json` reads.

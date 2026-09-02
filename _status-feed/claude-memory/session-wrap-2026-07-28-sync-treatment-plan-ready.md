---
name: session-wrap-2026-07-28-sync-treatment-plan-ready
description: "TRM-to-treatment sync skill: spec (4 review passes) + implementation plan both done and committed; execution deferred to a new session"
metadata: 
  node_type: memory
  type: project
  originSessionId: d606102f-397d-4ccc-a80b-ccf2dca4143a
  modified: 2026-07-29T03:07:46.702Z
---

Design + plan phase closed for [[finding-trm-fct-ids-not-stable-2026-07-28]]'s
subject. Nothing implemented yet — next session starts at execution.

- Spec: `docs/superpowers/specs/2026-07-28-trm-sync-treatment-design.md`
  (commits `b9c96a0`, `11a3817`, `88d019c`, `724c300`, `5de8238` — 4 review
  rounds, each found real issues: unstable FCT-### ids, dependency-map
  envelope shape conflict, permanent cross-host lock, silent factKey
  collision data loss, stale `cursorUpdateIncomplete` field).
- Plan: `docs/superpowers/plans/2026-07-28-trm-sync-treatment.md` (10 tasks,
  TDD, real code per step, self-reviewed).

Next session: pick execution mode (subagent-driven vs inline
`executing-plans`) and run the plan. Task 3 includes a one-time real edit
to `charlie-deep-research/treatment/CIC_SOURCING_DEPENDENCY_MAP_v1.json`
(bare array → versioned envelope) — separate repo, separate `git push`,
easy to forget (flagged in the plan's post-implementation checklist).

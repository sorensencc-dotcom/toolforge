---
name: retro-lockfile-loc-exclusion
description: Exclude lockfiles from LOC metrics in retro — metric tracked ~90% noise in Jul 12 run
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2b648cdc-3ef9-4191-a994-186d20f3827f
---

**Directive:** `/retro` skill must exclude lockfiles from all LOC metrics (insertions, deletions, net_loc, test_ratio denominator).

**Why:** 2026-07-12 retro reported 111k net LOC, but ~90% was lockfile churn (`package-lock.json`, `yarn.lock`, etc.). Metric tracked noise, not code. Breaks trend tracking and misrepresents actual work.

**How to apply (in /retro context.md or skill impl):**
- Filter paths during `git log --numstat`: exclude `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `Cargo.lock`, `poetry.lock`
- Report lockfile LOC separately on one line if material
- Recalculate test_ratio denominator without lockfile insertions
- This keeps metrics honest for trend tracking via `/retro compare`

**First valid baseline:** 2026-07-19 (after this rule lands in skill or retro-context.md)

Related: [[team_composition_phase8_onwards]], retro skill (gstack)

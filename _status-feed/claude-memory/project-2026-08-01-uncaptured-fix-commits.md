---
name: project-2026-08-01-uncaptured-fix-commits
description: "4 real fix commits landed 2026-08-01 that predated any memory write — retro-schema patch, lineage-lock concurrency, cost-spec gaps, torquequery routing gaps."
metadata: 
  node_type: memory
  type: project
  originSessionId: fddfc715-c90e-40b3-87a3-b3e940afb164
  modified: 2026-08-02T15:59:10.149Z
---

4 substantive fix commits landed 2026-08-01, all after `memory/MEMORY.md`'s prior edit (`44332e4`, 2026-07-29). Caught by a weekly session audit that noticed the gap — none of these had been fed back into memory until this entry.

- `c252eee` `fix(retro): patch 4 retro JSONs to canonical v1.0 schema` — `2026-07-29-1/2`, `2026-07-30-1`, `2026-07-31-1` were missing required v1.0 metrics fields. Filled with real derived values (not fabricated), `validate-v1.0.ps1` now 28/28 PASS. **Explicitly left open in the commit message: "generator root cause still open if it recurs."** That risk was not tracked anywhere else — tracking it here. See [[finding-trm-fct-ids-not-stable-2026-07-28]] for the general pattern of retro/generator drift in this repo.
- `5bb9c2d` `fix(governance): stabilize lineage lock concurrency` — `CIC-GOVERNANCE/WRAPPERS/governance_runtime.py`, 4-line change.
- `dcc222c` `fix(governance): close cost spec gaps` — `CIC-GOVERNANCE/SPEC/CIC-AI-AGENT-COST-SPEC-001.md`, 40/19 line change. Likely Antigravity-authored per [[project-cost-governance-runtime-antigravity-build]] — verify independently before relying on the spec text.
- `63ff3cc` `fix(torquequery): close routing policy gaps` — `.../specs/torquequery-ai-agent-routing-policy.md`, 39/14 line change. Same Antigravity-adjacent caveat applies.

**Why this matters:** memory was 3 days stale relative to real shipped work at the point this was caught. **How to apply:** when doing a session-start recall or a retro, check `git log --since=<last memory edit date>` across active submodules, not just the top-level repo, before assuming memory reflects current state.

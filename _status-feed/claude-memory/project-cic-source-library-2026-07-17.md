---
name: project-cic-source-library-2026-07-17
description: "Built treatment/CIC_SOURCE_LIBRARY.md in charlie-deep-research — 49-source greppable index, consolidating sources previously scattered across 4 prose work-logs"
metadata:
  node_type: memory
  type: project
  originSessionId: 6a039efb-4837-4f78-ba71-9dd56431833b
---

`C:\dev\charlie-deep-research\treatment\CIC_SOURCE_LIBRARY.md` — single table, ID/type/date/status/V-item-tags/claim/next-action columns, grep-able (`grep TARGET-UNLOCATED`, `grep "V-6.5"`, etc). Built by consolidating sources that were previously only findable by reading full prose work-logs in `CIC_SOURCING_PACKET_V-5.3.md`, `CIC_SOURCING_PACKET_V-6.5.md`, `CIC_SOURCING_SWEEP_TRANSCRIPT_2026-07-16.md`, and v13's own citation list — none of which cross-referenced each other.

**Why this mattered:** the sweep file alone had ~30 press citations logged in dense prose (Chronicling America hits, false-positive Sorenson name collisions, a Theodore Sorensen disambiguation trap) that neither sourcing packet's own work log knew existed, even when directly relevant (e.g. S-033, a third causal account of the 1944 exit, sat in the sweep file for a day unflagged to the V-6.5 packet that needed it).

**Maintenance rule the library establishes:** every new source found anywhere in the treatment work goes in this file in the same commit, with a sequential S-### ID. If it drifts out of sync, the individual packets remain the fallback source of truth (stated explicitly in the library's own maintenance section).

**Related:** [[finding-v13-treatment-discovery-2026-07-17]] (how v13 got folded in), [[project-torquequery-reconciliation-2026-07-17]] pattern of catching silent multi-source divergence generally.

**Governance gap also closed same session:** `CIC_GOVERNANCE_INHERITANCE_MAP_V1.1.md` invoked "Tier 1" throughout but never stated its authority model came from `c:\dev`'s root `global-operating-rules-cic-rewrite-labs.md` — a separate git repo/remote. Added a §0 documenting the dependency explicitly. No behavior change, closes a [[learning-two-skill-trees]]-class silent-drift risk.

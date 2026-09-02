---
name: finding-v13-treatment-discovery-2026-07-17
description: "User-supplied CastIronCharlie_Treatment_v13 revealed a real second treatment lineage the repo didn't have — corrected a prior wrong 'phantom citation' fix"
metadata:
  node_type: memory
  type: project
  originSessionId: 6a039efb-4837-4f78-ba71-9dd56431833b
---

Earlier same session I flagged "Treatment v13, Act Four" citations (in `CIC_ARRIVAL_DAY_CHECKLIST_2026-07-24.md` etc.) as phantom — no `v13` file existed in the `charlie-deep-research` repo, only `TREATMENT_DRAFT_v1/v1.1/v1.2.md`. I rewrote those citations to point at v1.2. **Wrong.** User then pasted the actual v13 file: a real, richer, external family/production treatment (Act-based, not Section-based; different authorship — Sorensen family/broadcast side, not the repo's own governance-apparatus drafts). I reverted my edit and ingested v13 properly at `treatment/CastIronCharlie_Treatment_v13_20260523.md`.

**Root cause of my error:** I treated "not found in this repo" as "doesn't exist" without asking whether an external source might be missing from the repo rather than fabricated. See [[learning-two-skill-trees]] for the same failure shape (assuming repo-local state is complete state).

**How to apply:** when a citation in a repo points to something not present locally, the default hypothesis should be "this repo is missing an artifact," not "this citation is an error" — especially in a project already known to span multiple repos/sources (family archive, external treatments, BFRC finding aids). Ask or flag before rewriting citations that look orphaned.

**Downstream value once corrected:** v13 turned out to directly bear on two BLOCKED remediation items — it names Logan Miller's LOC oral history (independent witness naming Bennett's role in Sorensen's 1944 ouster) for V-6.5, and its Consolidated Aircraft/San Diego framing for V-5.3 matched an independent 1995 Ann Arbor Observer account, clearing that item's CONTESTED-TAG bar. See [[project-cic-source-library-2026-07-17]].

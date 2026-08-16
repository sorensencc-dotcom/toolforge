---
name: ingestion-small-cleanup-corrected
description: "State-aligned cleanup instruction block (2026-06-29) — small hygiene only, no producer.ts, no cloud assumptions, no architectural refactor"
metadata: 
  node_type: memory
  type: reference
  originSessionId: d2fbbf7d-1d34-4479-994f-38749ce93498
---

# Ingestion Subsystem Cleanup — Small Scope (Current State Only)

**Status:** Ready to deploy. Reflects actual repo state 2026-06-29.  
**Scope:** Remove/archive stale ingestion references. NO producer.ts. NO architectural refactor.  
**Entry:** Phase 1 discovery → Phase 2 analysis → Phase 3 plan → Phase 4 approval → Phase 5 execution

---

## PHASE 1 — REPO DISCOVERY (CURRENT STATE ONLY)

Full scan of ingestion subsystem. Output:

**A. Current ingestion components**
- queue/daemon (in-memory TS)
- queue job schema
- envelope schema
- unused TS utilities
- commented-out ingestion references

**B. Scripts and configs**
- /scripts ingestion references
- /tools ingestion references
- root-level ingestion scripts
- package.json ingestion script entries

**C. Operator console references**
- ingestion polling entries
- ingestion agent health checks
- stale ingestion state references

**D. Tests**
- ingestion tests (active vs unused)
- queue tests
- tests referencing old ingestion behavior

Output: Full path, purpose, active/unused/stale, safe to clean (yes/no).

Do NOT modify.

---

## PHASE 2 — ANALYSIS OF CLEANUP CANDIDATES

Classify into:

**1. Safe to remove**
- commented-out ingestion code
- unused TS helpers
- stale scripts
- unused config fragments
- unused tests
- operator console polling entries (nonexistent states)

**2. Safe to archive**
- early queue prototypes
- unused envelope builders
- unused discovery utilities
- partial ingestion helpers (maybe useful later)

**3. Needs clarification**
- anything possibly part of future cloud-extension or deterministic producer

**4. Do not touch**
- current queue/daemon
- current ingestion flow
- Phase 1 local-first routing
- determinism guarantees

---

## PHASE 3 — PROPOSED SMALL CLEANUP PLAN

Minimal, safe cleanup:

**A. Remove:** items classified as safe
**B. Archive:** into cic-ingestion/legacy/
**C. Clarify:** list questions
**D. Preserve:** list untouchables

NO producer.ts. NO consumer.ts. NO cloud-extension. NO architectural refactor. Hygiene only.

---

## PHASE 4 — APPROVAL GATES

Ask user:
1. Remove vs archive which items?
2. Update operator console polling?
3. Prune package.json scripts?
4. Remove unused tests?
5. Archive early queue prototypes?
6. Generate patches or PRs?

**No action until explicit approval.**

---

## PHASE 5 — EXECUTION

After approval:
- Perform cleanup
- Generate patches
- Output diffs
- Verify determinism intact
- Final cleanup summary

---

## Constraint

This block assumes:
- Phase 1 complete (local-first routing, determinism)
- Cloud extension NOT yet integrated
- producer.ts does NOT exist
- No Python legacy ingestion present
- Current ingestion = TS queue/daemon only

Refactoring to producer pattern is FUTURE work (post-cloud-integration).

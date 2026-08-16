---
name: project-torquequery-reconciliation-2026-07-17
description: "RESOLVED 2026-07-17: Tier 1 approved split-and-rename. cic-ingestion keeps 'TorqueQuery' (memory search), rewrite-docs renamed to 'torque-query-docs' (doc-RAG), empty scaffold deleted."
metadata: 
  node_type: memory
  type: project
  originSessionId: feb35b8b-3e13-4d8b-b3c2-79b5c0ac19b5
---

TorqueQuery lost its tracking doc during the 2026-07-10 Ashfall cleanup, which split it out as "a separate initiative" (`docs/meta/phases/cic-ashfall-state.md:122`) without assigning an owner. Three implementations accumulated independently under the same name:

1. `cic/torquequery/` (main repo) — empty gitignored scaffold, no code
2. `cic-ingestion/src/services/torquequery/` — FastAPI memory/drift search server, canary-approved 2026-07-02 ([[phase-5-torquequery-v2-complete]])
3. `rewrite-docs/castironforge/torque-query/` — standalone doc-KB RAG service (Chroma/Ollama/BGE-reranker), self-reported near-complete

**Why:** User flagged "Phase 5 (TorqueQuery) still blocked — untracked." The two prior "Phase 5" memories ([[phase-5-torquequery-v2-complete]], [[session-2026-07-11-phase5-exit]]) are unrelated Phase 5s (canary rollout / multi-cohort in different repos) — do not conflate them with this TorqueQuery gap.

**How to apply:** Reconciliation charter at `docs/meta/phases/torquequery-reconciliation-charter.md` — 3 options drafted, split-and-rename recommended.

**Resolved 2026-07-17** (same day, follow-up): Tier 1 typed approval directly in the transcript — Option i (split and rename) APPROVED and executed. `cic-ingestion/src/services/torquequery/` keeps the name "TorqueQuery" (owner: CIC-Ingestion). `rewrite-docs/castironforge/torque-query/` renamed to `torque-query-docs/` via `git mv` (60 files, history preserved), owner Rewrite Labs. Empty `cic/torquequery/` scaffold deleted (gitignored, untracked, zero files — no commit needed). Adapter `torqueQueryV2.ts` confirmed already scoped to the memory-search service only, given an explicit permanent-scope comment. State doc addendum added to `docs/meta/phases/cic-ashfall-state.md`. Both repos' hardening docs (`HARDENING-NOTES.md`, `CANARY-VERIFICATION-2026-07-17.md`, module docstrings) updated from "pending Tier 1 decision" to "decided." Full execution log in the charter's Decision Log section. If you see this memory cited, the reconciliation is closed — do not re-open the naming question without new information.

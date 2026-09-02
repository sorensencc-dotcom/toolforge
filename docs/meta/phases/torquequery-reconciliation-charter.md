---
title: TorqueQuery Reconciliation Charter
date: 2026-07-17
status: TIER1_APPROVED
decision: APPROVED
approved_date: 2026-07-17
critical_path: false
deadline: TBD
---

# TorqueQuery Reconciliation Charter

## Executive Summary

TorqueQuery has no owning charter or phase doc since the 2026-07-10 Ashfall cleanup split it out as "a separate initiative" (`docs/meta/phases/cic-ashfall-state.md:122`) without assigning it one. In the absence of a tracking doc, three divergent implementations accumulated under the same name across three repos. This charter's scope is **reconciliation only**: inventory what exists, decide which implementation is canonical (or how they compose), and reconnect adapters — not a fresh build.

---

## Inventory: Three Divergent Implementations

### 1. `cic/torquequery/` (main repo, gitignored scaffold)
- **Status:** Empty. `config/`, `src/`, `storage/` all present but contain zero files, zero git history.
- **Gitignore:** `.gitignore:14` (`/cic/`)
- **Read as:** Placeholder directory only — not a working implementation.

### 2. `cic-ingestion/src/services/torquequery/` (separate repo)
- **Files:** `TorqueQueryV2Server.py`, `TorqueQueryClient.ts`; adapter at `src/adapters/torqueQueryV2.ts`
- **Purpose:** FastAPI memory/drift semantic search server for CIC agent memory (MMR/RRF fast-path, deterministic scoring)
- **Status:** Per `memory/phase-5-torquequery-v2-complete.md` (2026-07-02) — deployed, 3 validation harnesses PASS, canary gate **APPROVED**. Unclear if canary A/B/C rollout was ever executed post-approval; not evidenced in current repo state.

### 3. `rewrite-docs/castironforge/torque-query-docs/` (standalone Python package, renamed 2026-07-17 from `torque-query/` — see Decision Log)
- **Files:** Full project — `pyproject.toml`, Dockerfile, Makefile, `src/{fs,ingestion,rag,tools}`, `tests/`, `scripts/{ingest,watch}.py`
- **Purpose:** Local, deterministic, MkDocs-aware documentation RAG service (Chroma vector store, Ollama embeddings, BGE reranker, CIC agent wrapper + autoscheduler rule)
- **Status:** Self-declared `PHASE-26-READINESS.md` — every checklist item complete except "Snapshot tests added." Most functionally complete of the three.

**Naming collision:** all three call themselves "TorqueQuery" / "Phase 26 TorqueQuery" but solve different problems (memory search vs. doc-KB RAG vs. empty stub). They are not three parts of one system by design — they're parallel, uncoordinated builds.

---

## Scope

**In scope:**
- Confirm current functional state of implementations #2 and #3 (do they run today, against current deps?)
- Decide: single canonical TorqueQuery, or two named services (e.g., memory-search vs. doc-RAG) that both keep the name informally today
- Reconnect adapter(s) — `torqueQueryV2.ts` in cic-ingestion — to whichever implementation is canonical
- Remove or repurpose the empty `cic/torquequery/` scaffold (delete, or use as the canonical repo location once decided)
- Add one phase/state doc entry so this doesn't silently drop again

**Out of scope:**
- New feature work on any implementation until canonical decision made
- Building crawler/scraper/parser/indexer from scratch (already exists in #3; redundant to respec)
- Cross-repo submodule restructuring beyond what's needed to point adapters at the canonical implementation

---

## Decision Points

**Question:** Which implementation(s) become canonical TorqueQuery going forward?

**Options:**
1. **Two canonical services, renamed to avoid collision** — cic-ingestion's memory-search server keeps `TorqueQuery` (its existing canary-approved identity); rewrite-docs's doc-RAG engine gets a distinct name (e.g. `torque-query-docs` or similar) since it solves a different problem. Delete the empty `cic/torquequery/` scaffold.
2. **Single canonical, retire the other** — pick one (likely #3, most complete) as sole TorqueQuery; deprecate #2's server and repoint `cic-ingestion`'s adapter at #3 over the network/API boundary.
3. **Status quo, just document it** — leave both running under the same name, add a disambiguation note in each README pointing to the other. Lowest effort, doesn't resolve the naming collision risk.

**Recommendation:** Option 1. The two services solve genuinely different problems (agent memory search vs. doc KB RAG) — forcing them into one is likely to produce a worse system than keeping both, correctly named. The empty scaffold in #1 is dead weight either way.

No recommendation is executed without Tier 1 approval — this charter surfaces the decision, it does not make it.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Implementation #2 canary rollout status unverified | May be running in a state nobody is monitoring | Verify Canary A/B/C execution before any reconciliation decision |
| Implementation #3 "complete except snapshot tests" is self-reported, unverified externally | Charter could rest on stale/optimistic status | Run `make ingest && make serve` smoke test before relying on readiness doc |
| Adapter (`torqueQueryV2.ts`) currently points at #2 only | Reconciliation decision could break live integration | Confirm current adapter wiring before any repoint |
| Recurrence: this gap already happened once (Ashfall split, 2026-07-10) | Same silent drop could recur | This charter itself becomes the tracking doc; log status here going forward |

---

## Exit Criteria

- [x] Canonical decision made (Tier 1) and recorded in Decision Log below
- [x] Empty `cic/torquequery/` scaffold resolved (deleted — was gitignored, never tracked, contained zero files)
- [x] Adapter(s) confirmed pointed at canonical implementation(s) (`torqueQueryV2.ts` already exclusively called the memory-search service; never touched the doc-RAG service; scope comment added confirming this is permanent, not incidental)
- [x] Naming disambiguated (Option 1 executed — two services retained, one renamed)
- [x] This doc's decision reflected in `docs/meta/phases/cic-ashfall-state.md` (2026-07-17 addendum)

---

## Decision Log

- 2026-07-17: Charter drafted after user flagged "Phase 5 (TorqueQuery) still blocked — untracked." Investigation found no code-level blocker — three uncoordinated implementations exist across `cic/torquequery` (empty), `cic-ingestion/services/torquequery` (canary-approved 2026-07-02), `rewrite-docs/castironforge/torque-query` (self-reported near-complete). Gap is governance-doc-level only, traced to the Ashfall split (2026-07-10) leaving no owner. Charter pending Tier 1 review.
- 2026-07-17 ✅ **Tier 1 Approval:** Option 1 (referred to as "Option i" in the companion decision-packet artifact — same option, different numbering style) APPROVED. Decision, typed directly in the conversation transcript per the manual-approval guardrail:
  - **TorqueQuery (canonical)** keeps the name — the memory/drift search server at `cic-ingestion/src/services/torquequery/TorqueQueryV2Server.py`. Owner: CIC-Ingestion.
  - **torque-query-docs** — new name for the doc-KB RAG service, renamed from `rewrite-docs/castironforge/torque-query/` to `rewrite-docs/castironforge/torque-query-docs/`. Owner: Rewrite Labs.
  - Empty `cic/torquequery/` scaffold deleted (gitignored, untracked, zero files — no commit required for its removal).
  - Execution: directory renamed via `git mv` (60 files, history preserved); `pyproject.toml` name field, README, CI workflow paths, HARDENING-NOTES.md, PHASE-26-READINESS.md, and the draft TS client updated to the new name in `rewrite-docs` (commit pending push at time of writing); `TorqueQueryV2Server.py` module docstring, `/health` service_description, test docstring, HARDENING-NOTES.md, and CANARY-VERIFICATION-2026-07-17.md updated to reflect the approved (not pending) decision in `cic-ingestion`; `torqueQueryV2.ts` adapter given an explicit scope comment confirming it stays memory-search-only per this decision.
  - Fast-path determinism bug (found during pre-decision hardening) and the two doc-RAG bugs (frontmatter parse failure, `limit=0` validation gap) were fixed same-day, separately from this naming decision — see `memory/finding-torquequery-fastpath-nondeterminism-2026-07-17.md`.

---

**Charter Status:** APPROVED — EXECUTED

**Next Step:** None outstanding on this charter. Follow-up: if `torque-query-docs` is ever wired into a CIC adapter, that is new work requiring its own scoping, not covered by this charter.

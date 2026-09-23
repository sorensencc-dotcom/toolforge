---
name: session-wrap-2026-09-06-ironledger-phase-3-spec
description: IronLedger Phase 3 (Beancount compiler + recovery journal) design spec written and committed; 8 decisions locked; next is writing-plans then plan-eng-review then SDD.
metadata: 
  node_type: memory
  type: project
  originSessionId: 63beb24a-ffa5-47a9-b571-0fe1a565744a
  modified: 2026-09-06T13:47:06.639Z
---

# Session Wrap: IronLedger Phase 3 spec drafted (2026-09-06)

Phase 2b closed and operator-approved before this session (IronLedger repo HEAD `4d77e5a`, 254 pass / 1 skip).
This session brainstormed and wrote the **Phase 3 design spec only**. No code, no plan yet.

## Deliverable

- Spec: `c:\dev\docs\meta\specs\ironledger-phase-3-compiler-design.md`
- Committed `10121dba` on branch **`ironledger/phase-3-spec`** in `C:\dev` governed-docs repo.
  Branch cut from the daemon-churned `ironledger/phase-2b-spec` tip, so it carries ~50 unrelated
  daemon-modified files. On merge to `main`, cherry-pick ONLY the `docs(ironledger)` commit(s),
  same as Phase 2a/2b evidence branches. Not pushed.

## 8 locked design decisions (all in the spec)

1. `bean-check` = **pinned subprocess**; `beancount` `==`-pinned in `pyproject.toml`, never imported on
   the accounting path. Dependency-posture doc gets a Phase 3 amendment.
2. **Full deterministic regeneration** per `compile`; output is a pure function of the `approved` set.
3. Compile **populates `ledger_entries`/`ledger_postings`** (migration 0001, empty now), stamped by
   `compile_run_id`, replaced not appended on recompile. Phase 4 is still the separate analytics/FTS projection.
4. New migration **`0005_compile_journal.sql`** — append-only, explicit monotonic `seq` like
   `audit_events`, UPDATE/DELETE triggers RAISE(ABORT) like 0002. `compile_runs` unchanged; `refused`
   is a journal-only state.
5. **`accounts.beancount` fully generated** from referenced accounts (one `open` at earliest posting
   date, single currency; second currency for an account = compile refusal).
6. Commands `compile` / `compile status` (read-only) / `compile recover`; phrases `authorize compile`
   and `authorize compile recover`; safe-mode gates both mutators; `ledger/.compile.lock` serializes.
7. **Recovery decision table** (spec §11): finish the `os.replace` sequence only when staging hash ==
   `intended_output_hash`; refuse on any ambiguity/dual-mismatch (run stays `started`); recompile from
   clean always safe.
8. Deterministic Beancount output (§4): entry order `(proposed_date, identity_fingerprint)`, `imported`
   then `contra` leg, amount from `minor_units`/`minor_unit_scale`, flag `*`, LF, 2-space indent,
   source linkage as posting metadata + `staged-transaction-id` on the entry.

Planned package `src/ironledger/compile/`: `model / render / hashing / beancheck / journal / writer /
recover / errors`. CLI: `cli/__main__.py`, `cli/auth.py`, `cli/render.py`. Spec §14 = 17-point exit-gate
test contract.

## Resume (fresh session)

1. Operator reviews the spec.
2. `superpowers:writing-plans` -> ~15 TDD tasks, discipline of `docs/meta/plans/ironledger-phase-2b-plan.md`.
   Task 1 writes `0005` whole (checksum frozen after).
3. `/plan-eng-review` BEFORE first plan commit; fold findings into spec+plan in one commit (like 2b `82f602b3`).
4. Operator approves the plan in transcript.
5. `superpowers:subagent-driven-development` against the plan, **cwd `C:\dev\IronLedger`**.
   Baseline before Task 1: **254 passed, 1 skipped** (`PYTHONPATH=src python -m pytest -q`).

## Governance carried forward

- `C:\dev\IronLedger` approved home (D-0), no remote, no push.
- Focused-suite evidence only; live imports + full-suite deferred.
- Operator review of exit evidence gates each next phase.
- Governed-docs preflight: `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev`.

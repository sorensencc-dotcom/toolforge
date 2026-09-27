---
title: "Docs Audit Remediation — Tier 1 Proposal"
document_id: "PROPOSAL-2026-09-26-DOCS-AUDIT"
category: "proposal"
status: "awaiting Tier 1 review"
date: 2026-09-26
---

# Docs Audit Remediation — Tier 1 Proposal

Four decisions from the 2026-09-26 documentation audit (Codex-reviewed) need Tier 1 ratification
before they're applied. This doc bundles them for one review pass.

## Decision 1: Operational-status contradiction

`CIC-GOVERNANCE/README.md:12` says `IMPLEMENTED CANDIDATE — NOT OPERATIONAL`.
`MANIFEST/runtime-status.json` says `OPERATIONAL`. `MANIFEST/gate-registry.json:37` says
`runtime_active: true`. Pick one:

- **A.** README is stale — update it to reflect OPERATIONAL/active, matching the two
  machine-readable state files.
- **B.** The machine-readable files are premature — set `runtime-status.json` back to a
  non-operational state and `gate-registry.json`'s `runtime_active` to `false` until README's
  conditions are actually met.

No recommendation made here — this is a factual-state call only Tier 1 can make.

## Decision 2: Cut over `gate-implementation-status.md` to the generator

Task 5 built `CIC-GOVERNANCE/scripts/generate-gate-status.mjs`, a pure-function generator with
tests, driven by the three JSON registries. Diff against the current hand-written file:

```diff
2c2
< title: "Gate Implementation Status"
---
> title: "Gate Implementation Status (generated)"
5,6c5
< status: "candidate"
< version: "1.0.0"
---
> generator: "CIC-GOVERNANCE/scripts/generate-gate-status.mjs"
9d7
< 
12,40c10,24
< Date: 2026-07-17 (refreshed — see note below)
< Overall: `ALL GATES CLOSED — GATE-01 THROUGH GATE-05 RATIFIED`
< 
< | Gate | Implemented candidate mechanics | Local tests | Closure |
< | --- | --- | ---: | --- |
< | GATE-01 | Atomic replacement, byte restoration, transaction IDs, rollback lineage | 8 | CLOSED by `AMD-v2.4.0-GATE-01-CLOSED`; R2 passed 15/15; inferred NTFS acknowledged by Manifest Owner |
< | GATE-02 | Consumer isolation, retries, failure query, manual republish, idempotency guard, child events | 8 | CLOSED by `AMD-v2.4.0-GATE-02-CLOSED`; R2 (`CIC-TEST-REPORT-GATE-02-R2`) passed 8/8 on NTFS; ratified by Tier 1 (Chris), 2026-07-14 |
< | GATE-03 | Persistent JSON registry, ordered states, audit lineage, export, bootstrap rotation | 9 | CLOSED by `AMD-v2.4.0-GATE-03-CLOSED`; R2 (`CIC-TEST-REPORT-GATE-03-R2`) passed 9/9; ratified by Tier 1 (Chris), 2026-07-14 |
< | GATE-04 | Atomic lock file, timeout, stale expiry, UUID IDs, hash chain, partial-tail quarantine | 8 | CLOSED by `AMD-v2.4.0-GATE-04-CLOSED`; process-level R2 passed 8/8 on NTFS |
< | GATE-05 | Open-gate rejection and declaration validator | 1 | CLOSED by `AMD-v2.4.0-GATE-05-CLOSED`; R2 (`CIC-TEST-REPORT-GATE-05-R2`) passed 1/1; ratified by Tier 1 (Chris), 2026-07-14. Runtime activation tracked separately (`runtime-status.json`: `OPERATIONAL`) |
< 
< Baseline ingestion suite contributes 12 tests. Total local suite: 46 tests.
< 
< All five closure amendments (`AMD-v2.4.0-GATE-0{1..5}-CLOSED`) are `RATIFIED`
< in `CIC-GOVERNANCE/AMENDMENTS/`, each with a matching ratification
< confirmation in `CIC-GOVERNANCE/confirmation/` and a `closure_lineage_id` in
< `MANIFEST/gate-registry.json` (`CIC-GATE-SPEC-001` v1.0.4-candidate.1,
< `STABLE / SEALED`). `.draft.json` amendment files for GATE-03/GATE-05 remain
< in `AMENDMENTS/` alongside their ratified counterparts — superseded drafts,
< not open work.
< 
< **Note:** this file previously said only GATE-01/GATE-04 were closed (dated
< 2026-07-14, `CANDIDATE` status) and was never updated after GATE-02/03/05
< ratified that same day. Discovered stale during CIC Tool Surface Phase 4
< work (`docs/meta/specs/cic-tool-surface-phase4-design.md`) and refreshed
< against `gate-registry.json` + `AMENDMENTS/` + `confirmation/` as the source
< of truth. `cic-run-gate`'s adapter (`CIC-GOVERNANCE/adapters/run_gate_adapter.py`)
< still only wires `GATE-01` — extending `GATE_HANDLERS` for GATE-02/03/05 is
< a separate, unspec'd change, not implied by this doc refresh.
---
> > Generated from `gate-registry.json`, `amendment-registry.json`, and
> > `runtime-status.json`. Do not hand-edit — edit the source registries and
> > regenerate instead.
> 
> Gate registry status: STABLE / SEALED
> Amendment registry status: DRAFT
> Runtime status (runtime-status.json): OPERATIONAL
> 
> | Gate | Name | Status | Closure amendment |
> | --- | --- | --- | --- |
> | GATE-01 | Artifact-Store Transaction / Rollback | CLOSED | AMD-v2.4.0-GATE-01-CLOSED |
> | GATE-02 | Publication and Retries | CLOSED | AMD-v2.4.0-GATE-02-CLOSED |
> | GATE-03 | Persistent Actor Registry | CLOSED | AMD-v2.4.0-GATE-03-CLOSED |
> | GATE-04 | Cross-Process Lineage Locking | CLOSED | AMD-v2.4.0-GATE-04-CLOSED |
> | GATE-05 | Tier 1 Ratification | CLOSED | AMD-v2.4.0-GATE-05-CLOSED |
```

If approved: wire the generator into a pre-commit hook or CI step that regenerates
`gate-implementation-status.md` on every change to the three source registries, and delete the
hand-maintained-file assumption from this doc's own text.

**Known gaps in the generator, found during Task 5 (for Tier 1 to weigh before approving
cutover):**
- The generator only emits tabular status/name/closure-amendment fields. The current
  hand-written file carries richer narrative (per-gate test counts, ratification lineage
  detail, a stale-doc self-correction note, and an adapter-wiring caveat) that the generator
  does not reproduce. Cutover as-is would lose that narrative context unless it's added to the
  generator first or preserved in a separate doc.
- `amendment-registry.json`'s top-level `status` field reads `DRAFT` while every individual
  amendment inside it reads `RATIFIED` — a registry-level vs. amendment-level status
  terminology mismatch worth resolving (or at least clarifying in the generated output) before
  this is treated as authoritative.
- The CLI's direct-invocation entrypoint (`node generate-gate-status.mjs`) has a known bug on
  Windows (the `import.meta.url`-vs-`process.argv[1]` guard never matches due to path-separator
  differences) — harmless today since nothing invokes it directly yet, but must be fixed
  (e.g. `fileURLToPath(import.meta.url) === resolve(process.argv[1])`) before any CI/pre-commit
  wiring is built on top of it.

## Decision 3: Codex-validation-report artifact class

No durable Codex report artifact exists — only `.tmp/codex-review-*.txt` (transient, untracked)
and `CIC-GOVERNANCE/logs/codex/*.log` (raw execution traces). Proposed: a new
`CIC-GOVERNANCE/tests/reports/codex-validation-<date>.json` schema mirroring the existing
`CIC-TEST-REPORT-GATE-*.json` pattern (same directory, same versioning convention). Needs
Tier 1 sign-off on: schema shape, retention period, and what triggers a new report (every Codex
gate run? Only on doc changes? Manual only?).

## Decision 4: Publish CIC-GOVERNANCE state to the MkDocs site

`CIC-GOVERNANCE/` is absent from `rewrite-mcp/mkdocs.yml` — the actual ratified/operational
state is unpublished. Proposed nav addition:

```yaml
  - Governance:
      - CIC-GOVERNANCE Status: cic-governance/index.md
      - Amendment Registry: cic-governance/amendments.md
      - Gate Registry: cic-governance/gates.md
```

Needs Tier 1 sign-off because publishing gate/amendment state externally-visible (even on an
internal MkDocs site) is a visibility-scope decision, not a pure doc fix.

---
name: phase-1-local-first-implementation
description: "Phase 1 local-first infrastructure complete — 10 files created/modified, all tests passing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7e6bdb5a-54b7-4d24-a9e9-685f40ec28c9
---

## Phase 1: Deterministic Local-First CIC Mode — Implementation Complete

**Date**: 2026-06-29  
**Status**: COMPLETE ✅  
**Tests**: 16/16 PASS (C-1 determinism + 7 manual verifications)

### Files Modified (4)

- `C:\dev\runtime\config\runtime-config.json` — added `localFirst` block (enabled, allowRemote, preferredBackends)
- `C:\dev\runtime\config\runtime-config.ts` — added `RuntimeConfig`/`LocalFirstConfig` types, `isLocalFirstEnabled()` helper
- `C:\dev\snapshot\world\world-state.json` — added `"localFirst": true` and `"ingestedAssets": []` key
- `C:\dev\final\certificate.json` — added `"localFirst": true` to `sandbox3` entry

### Files Created (6)

- `C:\dev\local-first\profile.json` — sealed manifest declaring local-first mode (version, flags, agents, backends)
- `C:\dev\routing\local-first-router.ts` — wraps MAAL `route()`, enforces `offline_required` + tags, hard-asserts no cloud endpoints
- `C:\dev\messaging\local-first-bus.ts` — deterministic FIFO bus: logical seq counter, SHA-256 hash chain per channel, key-sorted JSON
- `C:\dev\final\local-first-certificate.json` — cert template with `mode/deterministic/sealed/offline` flags
- `C:\dev\snapshot\torque\local-first-queries.json` — 5 TorqueQuery queries (enabled/agents/backends/snapshot/certificate checks)
- `C:\dev\audit\local-first-execution-trace.json` — execution trace template schema

### Key Design Decisions Locked

1. **Deterministic entropy** — `runId = SHA-256(sorted input paths)`, message bus `timestamp = logical counter` (not `Date.now()`), JSON key-sorted before hashing → byte-for-byte reproducible
2. **world-state structure** — separate `ingestedAssets` key (not polluting `components` list of architectural subsystems)
3. **Drift protection** — `routeLocalFirst()` hard-asserts local backend selection; throws if MAAL selects cloud endpoint
4. **Seal timestamp handling** — `completed` field excluded from `finalSealHash` calculation to preserve reproducibility while keeping human-readable timestamps

### Test Results

| Test | Result |
|------|--------|
| C-1 Routing Profile Determinism (9 tests) | ✅ PASS |
| Config reading (isLocalFirstEnabled) | ✅ PASS |
| world-state.json structure | ✅ PASS |
| certificate.json localFirst flag | ✅ PASS |
| routeLocalFirst() enforcement | ✅ PASS |
| Deterministic routing (100 iterations) | ✅ PASS |
| LocalFirstBus hash chain | ✅ PASS |
| local-first/profile.json sealed | ✅ PASS |

### Next: Phase 2

Multi-pipeline ingestion (docs+images → corpus/training/treatment/redesign). Builds on Phase 1:
- `unified-ingestion-adapter.ts` — normalize docs+images
- `multi-pipeline-orchestrator.ts` — fan into 4 sealed pipelines
- `final/multi-pipeline-seal.json` — prove all 4 ran deterministically
- `snapshot/multi-pipeline-delta.json` — world-state delta

### Post-Implementation Audit (2026-06-29)

Three critical bugs identified and fixed:

1. **Hash Chain Violation** — `prevId` was not included in message ID hash calculation. Fixed by incorporating `${prev ?? "null"}` into hash input (line 50, local-first-bus.ts).

2. **FIFO Ordering Violation** — `receive()` sorted channels alphabetically instead of by message timestamp, breaking chronological delivery. Fixed by comparing head message timestamps across all channels and popping the oldest (lines 74-92, local-first-bus.ts).

3. **Missing Query Adapter** — `torque-adapter.ts` did not load `local-first-queries.json`. Fixed by adding `loadLocalFirstQueries()` export.

**Test Results**: 1493 PASS / 21 FAIL (fails unrelated to local-first — node-cron ESM issues).

### Phase 2: Multi-Pipeline Ingestion — Implementation Complete (2026-06-29)

**Status**: COMPLETE ✅  
**Tests**: 5/5 PASS (unified adapter + orchestrator + seal/delta templates)

**Files Created (4)**:
- `C:\dev\ingestion\unified-ingestion-adapter.ts` — normalize docs+images → NormalizedAsset[], deterministic 768-d embeddings (seeded RNG, no network)
- `C:\dev\ingestion\multi-pipeline-orchestrator.ts` — fan into corpus/training/treatment/rewrite-labs, returns { status, hash, messages }
- `C:\dev\final\multi-pipeline-seal.json` — template proving all 4 pipelines ran deterministically
- `C:\dev\snapshot\multi-pipeline-delta.json` — records world-state changes (append ingestedAssets, write training/rewrite metadata)

**Fixes Applied**:
1. LocalFirstBus message retention — `PipelineResult` now captures `messages: any[]` for Phase 3 auditing
2. De-duplication in world-state.json — use `Set` to prevent duplicate assetIds on re-ingestion
3. Defensive directory creation — `fs.mkdirSync("data", { recursive: true })` in both training/rewrite pipelines

### Phase 3: Trace Emitter + Operator Console — Implementation Complete (2026-06-29)

**Status**: COMPLETE ✅  
**Tests**: 6/6 PASS (trace emit/load + console derive/load + report + enumeration)

**Files Created (3)**:
- `C:\dev\ingestion\trace-emitter.ts` — emits `audit/runs/<runId>.json` with full orchestration state (pipelines, messages, hashes, fingerprint)
- `C:\dev\ingestion\operator-console-view.ts` — derives `OperatorConsoleView`, writes `data/console/<runId>-console.json`, generates text report
- `C:\dev\snapshot\torque\ingestion-queries.json` — 5 sealed TorqueQuery queries (asset-count, mode-check, pipeline-status, components-list, snapshot-hash)

**Key Design**:
- Trace fingerprint = SHA256(sorted input paths) for determinism
- Snapshot hash computed live from world-state.json
- Console view aggregates 4 pipelines into human-readable summary (routing, backends, certificates)
- Report generator outputs formatted text for operator dashboards

### Notes for Future Sessions

- Local-first mode is now **sealed, reproducible, and fully offline** (no RNG, no timestamps, no network calls)
- Same inputs → same routing → same messages → same snapshot → same final seal hash
- Hard assertions prevent silent breaches of local-only guarantee (fail fast, fail loud)
- TorqueQuery queries can now prove at runtime: "is this system local-first?"
- Message bus now cryptographically chains all messages: prev hash included in current message ID
- Deterministic FIFO delivery: messages consumed in logical sequence order, not channel order
### Phase 4: Governance — Approval Gates + Audit Policy (2026-06-29)

**Status**: COMPLETE ✅  
**Tests**: 9/9 PASS (approval gates, audit checks, promotion/rollback, orchestration)

**Files Created (4)**:
- `C:\dev\governance\approval-gate.ts` — deterministic gate creation, approval collection, validation
- `C:\dev\governance\audit-policy.ts` — policy enforcement (min 2 approvals, all tests pass, 5-min cooldown)
- `C:\dev\governance\promotion-rollback.ts` — stage progression (sandbox→canary→staging→prod), safety checks
- `C:\dev\governance\governance-orchestrator.ts` — 5-phase promotion flow + rollback orchestration

**Key Policies**:
- Approval gates require 2+ approvers (deterministic signature via SHA-256)
- All tests must pass before promotion to staging/prod
- 5-minute cooldown enforced between promotion and rollback
- One-stage-at-a-time forward progression only
- Full audit trail on every promotion/rollback event

**Governance Flows**:
- **Promotion**: path validation → approval collection → gate validation → audit checks → execution
- **Rollback**: safety check (cooldown) → record creation → completion → audit

- **Phase 1–4 complete**: local-first sealed mode, unified ingestion, trace emission, governance enforcement
- **Ready for Phase 5**: operational playbooks, runbooks, production monitoring

---
name: phase-27-ingestion-autonomy-locked
description: "Phase 27 complete specification locked — 6-wave implementation plan (A–F), 9.3 days, ready to code"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5fe81b8c-c66a-4140-8b7d-2061a674ad2f
---

# Phase 27 Ingestion Autonomy — LOCKED

**Status:** 📋 Spec Locked (commit d98e679)  
**Date:** 2026-07-07  
**Duration:** 9.3 days  
**Waves:** A → B → C → D → E → F (sequential, 1 commit each)

## What Phase 27 Does

Replaces log-polling with routing-based autonomy:
- **Wave A:** Type system + profiles (Lane, OperatorFlags, ManifestRecord, ingestionProfiles.json)
- **Wave B:** Router engine + atomic manifest persistence (lock-guarded JSONL append)
- **Wave C:** Daemon wiring (route → extract → verify → record workflow)
- **Wave D:** Operator CLI (quarantine:list, approve, reject commands)
- **Wave E:** Durability (repairManifest, pruneManifest, 90-day retention)
- **Wave F:** Nightly gates + documentation (ingestionRoutingGolden.json fixtures, rollback tested)

## Key Specs

**Concurrency safety:**
- Lock file pattern: acquire `ingestionManifest.lock` (O_EXCL) before append
- Temp → fsync → append → release lock pattern (atomic on Windows + Linux)
- FileLockedError thrown if concurrent access detected

**Cost propagation:**
- Extractors return `{ output, cost }`
- Verification returns `{ passed, errors, cost }`
- Daemon computes `totalCost = extractorCost + verificationCost`
- Manifest records track all three (Phase 28 prep)

**Retry semantics:**
- `retryCount` field in manifest
- `maxRetries` (global 3, or per-profile override)
- After maxRetries exceeded → set `skip = true`, log for operator visibility (prevents infinite loop)

**Manifest lifecycle:**
- Append-only JSONL (ingestionManifest.jsonl)
- 90-day retention policy (older records archived to ingestionManifest.archive.YYYY-MM-DD.jsonl)
- Repair tooling (repairManifest.ts) validates + removes corrupted lines
- Prune tooling (pruneManifest.ts) manages retention + archival

**Rollback:**
- Env flag: `CIC_INGESTION_ROUTING_ENABLED` (default: true)
- When false → daemon uses Phase 26 behavior (single extractor path, no routing)
- Manifest still written with `profile="legacy"`, `routingVersion="legacy"`
- All Phase 26 gates remain passing

## Deliverables

**Docs:**
- `docs/cic/phases/phase-27-implementation-checklist.md` ✅ (commit d98e679)
- `docs/cic/phases/phase-27-ingestion-autonomy.md` (Wave F, full spec)
- `docs/cic/phases/phase-27-rollback.md` (Wave F, rollback procedures)

**Code (6 commits):**
1. Wave A: types.ts + ingestionProfiles.json + schema validation
2. Wave B: ingestionRouter.ts + ingestionManifest.ts (core)
3. Wave C: daemon.ts wiring + operatorOverrides.json
4. Wave D: quarantineReview.ts + CLI commands
5. Wave E: repairManifest.ts + pruneManifest.ts
6. Wave F: nightly gates + golden fixtures + documentation

**Nightly gates (all must pass to ship):**
- ingestion_types_validation_gate
- ingestion_routing_gate
- ingestion_daemon_integration_gate
- ingestion_quarantine_cli_gate
- ingestion_manifest_durability_gate
- phase_27_complete_gate (meta-gate: all Phase 27 gates pass)

**Ship criteria:**
- All 6 waves commit cleanly
- All Phase 27 gates ✅
- All Phase 26 gates ✅ (backward-compatible)
- No concurrent write errors
- Cost fields populated
- CLI commands work
- Rollback tested
- Documentation complete

## Next Step

Begin **Wave A:** Create types.ts with Lane, OperatorFlags, RoutedIngestionDecision, ManifestRecord interfaces, and ingestionProfiles.json with filesystem/api/image profiles.

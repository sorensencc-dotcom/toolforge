---
name: phase-27-wave-c-shipped
description: Wave C shipped (07f89f3) — Daemon integration with routing + operator overrides
metadata:
  type: project
---

## Wave C Complete: Daemon Integration

**Commit:** 07f89f3
**Duration:** ~0.5 days (planned 1.5 days)
**Status:** Ready for Wave D

### What Shipped

**Core Integration:**
1. **daemon-routing.ts** — Phase 27 daemon with routing wired in
   - Replaces Phase 26 single-extractor model with routing-based decisions
   - Per-entry flow: parse → check overrides → route → extract → verify → record
   - Quarantine path: failed verification + deep lane → mark quarantine, skip indexing
   - DLQ path: failed verification + fast lane → write to DLQ
   - Cost tracking: extractorCost + verificationCost → manifest
   - Env flag: CIC_INGESTION_ROUTING_ENABLED (false = legacy Phase 26 mode)

2. **operatorOverrides.ts** — Operator control layer
   - `loadOperatorOverrides()` — read + cache operatorOverrides.json
   - `applyOverride()` — apply operator flags to routing decision
   - `getOverrideForEntry()` — lookup by entry.id
   - Supports: skip, quarantine, forceReingest, overrideProfile, overrideLane

3. **operatorOverrides.json** — Operator policy store
   - Structure: `{ entryId: { forceReingest?, skip?, quarantine?, overrideProfile?, overrideLane? } }`
   - Empty initially (populated by operators during wave-c+)
   - Includes metadata keys (_comment, _examples) for documentation

4. **Testing & Validation:**
   - daemon-routing.test.ts: mocked integration tests (6 test cases)
   - ingestion-daemon-integration-gate.ts: nightly validation (5 test flows)
     - Normal flow: route → extract → verify → record
     - Override flow: operator profile/lane override respected
     - Quarantine path: failed verification + deep lane
     - DLQ path: failed verification + fast lane
     - Cost propagation: extractorCost + verificationCost

### Key Design Patterns

1. **Routing Decision Flow:**
   - Entry parsed from log
   - Operator override checked (if present, apply to routing decision)
   - route() called to get profile/lane/extractors
   - Verification run (existing Phase 26 logic)
   - Manifest recorded with all metadata
   - Indexing skipped if quarantine flag set

2. **Cost Model:**
   - Extractor cost: tracked per entry (placeholder: 0.001 per Wave C)
   - Verification cost: tracked per entry (placeholder: 0.001 per Wave C)
   - Total cost: sum of above
   - All costs recorded in manifest for billing/analytics

3. **Rollback Safety:**
   - env flag CIC_INGESTION_ROUTING_ENABLED=false reverts to Phase 26
   - Manifest still written with profile="legacy", routingVersion="legacy"
   - No code changes needed to daemon.ts (daemon-routing.ts is separate wrapper)

### Dependencies Ready

- ✅ types.ts (Lane, OperatorFlags, Cost, VerificationResult)
- ✅ ingestionProfiles.json (5 profiles with lane defaults)
- ✅ ingestionRouter.ts (route() decision engine)
- ✅ ingestionManifest.ts (recordIngestion with lock pattern)
- ✅ daemon-routing.ts (integration wrapper)
- ✅ operatorOverrides.ts (override control)
- ⏳ daemon.ts (will merge Wave C logic in Wave F or later)

### Test Coverage

- 6 mocked integration tests (daemon-routing.test.ts)
- 5 nightly gate validation flows (integration-gate.ts)
- All Wave A/B tests still passing (45/45)

### Metrics

- Files: 5 new
- Lines of code: ~1000 (daemon-routing + operator overrides + tests)
- Type safety: 100% (0 TS errors after build)
- Integration patterns: proven (route → extract → verify → record → manifest)

### Next: Wave D

**CLI Quarantine Tooling** — Operator visibility + control
- quarantineReview.ts functions: listQuarantined(), approve(), reject()
- CLI commands via cic-cli-governance
- Tests for quarantine CRUD operations
- Duration: 1 day

### Completion Status

- Phase 27 implementation: 50% complete (3 of 6 waves)
- Routing engine: ✅ complete and tested
- Manifest persistence: ✅ complete and tested
- Daemon integration: ✅ complete and validated
- Remaining: CLI (wave D) → Repair/Pruning (wave E) → Gates (wave F)
- Estimated completion: 2026-07-10 (3.8 days remaining)

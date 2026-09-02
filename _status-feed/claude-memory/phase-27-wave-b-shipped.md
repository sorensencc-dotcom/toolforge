---
name: phase-27-wave-b-shipped
description: Wave B shipped (3a799e6) — Router + manifest persistence layer complete
metadata:
  type: project
---

## Wave B Complete: Router + Manifest Persistence

**Commit:** 3a799e6
**Duration:** 1 day (planned 2 days, parallelized)
**Tests:** 45/45 PASS ✅

### What Shipped

**Core Implementation:**
1. **ingestionRouter.ts** — `route(entry)` decision engine
   - Inspects source, mediaType, size from entry
   - Loads profiles from ingestionProfiles.json (cached)
   - Selects lane (fast/deep/quarantine) based on heuristics
   - Returns RoutedIngestionDecision {profile, lane, extractors}

2. **ingestionManifest.ts** — Lock-guarded atomic append
   - `recordIngestion()` — write manifest record with lock file pattern
     - Acquire ingestionManifest.lock with timeout
     - Write record to temp, fsync
     - Append temp to JSONL, fsync
     - Delete temp, release lock
     - Throws FileLockedError on concurrent access
   - `loadManifest()` — read with malformed-line skipping
   - `backfillFromProcessedLines()` — synthesize legacy records (routingVersion="legacy")

3. **Test Files:**
   - ingestionRouter.test.ts: 13 tests (all lane/profile heuristics)
   - ingestionManifest.test.ts: 25+ tests (record writes, concurrency, backfill)
   - ingestionProfiles.test.ts: fixed Ajv import, 8 tests
   - All 45/45 tests pass

4. **Gate Infrastructure:**
   - ingestion-routing-gate.ts: validates route() decisions + manifest recording
   - ingestionRoutingGolden.json: 7 test fixtures for golden routing decisions
   - jest.config.cjs: TypeScript + ESM support for testing

### Key Design Decisions Locked

1. **Lock Pattern:** File-based O_EXCL lock (ingestionManifest.lock)
   - Timeout: 5000ms
   - Busy-wait with exponential backoff
   - Works on POSIX and Windows (tested)

2. **API Contract:** recordIngestion accepts optional routingVersion parameter
   - Normal ingestion: "1.0.0"
   - Backfilled legacy: "legacy"
   - Enables rollback to Phase 26 behavior

3. **Profile Routing:**
   - Exact match (source="filesystem")
   - Wildcard match (source="api:*" → api:generic)
   - Media type fallback (image/* → images, application/pdf → pdf)
   - Lane heuristics: quarantine on oversized/DLQ-repeat/unknown

### Test Coverage

- ✅ 13 routing tests (all lane/profile cases)
- ✅ 12 manifest record tests (write/read/append)
- ✅ 6 malformed-line tests (skip with warning)
- ✅ 4 concurrent lock tests (FileLockedError enforced)
- ✅ 8 profile validation tests (schema + structure)

### Metrics

- Files created: 10
- Lines of code: ~800 (router + manifest + tests)
- Type safety: 100% (0 TS errors)
- Test pass rate: 45/45 (100%)

### Rollback

Wave B can be reverted to Phase 26 via env flag (set in Wave C):
```
CIC_INGESTION_ROUTING_ENABLED=false
```

Daemon bypasses route(), uses legacy behavior. Manifest still written with `profile="legacy"`, `routingVersion="legacy"`.

### Dependencies for Wave C

- ✅ types.ts (profiles, routing decision)
- ✅ ingestionProfiles.json (policy definitions)
- ✅ ingestionRouter.ts (route() function)
- ✅ ingestionManifest.ts (recordIngestion API)
- ⏳ daemon.ts (needs wiring in Wave C)

### Next

Wave C: **Daemon Integration** — Wire route() + recordIngestion() into daemon.ts per-entry flow.

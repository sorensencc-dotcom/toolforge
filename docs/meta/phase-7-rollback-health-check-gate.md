# Phase 7: Rollback Health-Check Gate Specification

**Status:** DRAFT  
**Phase Entry:** 2026-07-19 (contingent on Tier 1 approval 2026-07-15)  
**Scope:** Post-rollback validation, consistency gates, auto-rollback on failure  
**Requirement:** Mandatory. No promotion restart until health gate passes.

---

## 1. Overview

After Phase 7 config + feature flag rollback completes, the **Health-Check Gate** validates that all layers returned to consistent, known-good state. Gate blocks promotion restart if any check fails; ops must intervene manually.

**NOT eventual consistency.** Gate requires strong consistency across all layers within 90-second stabilization window.

---

## 2. Health Check Components

### 2.1 Component Dependencies

```
Phase 7 RollbackExecutor.executeRollback()
  ├─ Phase 6 StateStore rollback (existing)
  ├─ Phase 6 Database rollback (existing)
  ├─ Phase 6 Cache rollback (existing)
  ├─ Phase 7 ConfigRollback (NEW)
  ├─ Phase 7 FeatureFlagRollback (NEW)
  └─ [GATE] HealthCheckGate.validateRollback() ← MANDATORY before exit
     ├─ StateStoreConsistency (Phase 6)
     ├─ DatabaseConsistency (Phase 6)
     ├─ CacheConsistency (Phase 6)
     ├─ ConfigConsistency (Phase 7)
     ├─ FeatureFlagConsistency (Phase 7)
     ├─ RollbackLineageComplete (Phase 7)
     └─ LatencyGate (all layers <1s verify time)
```

### 2.2 Per-Layer Health Checks

| Layer | Check | Threshold | Timeout | Authority |
|-------|-------|-----------|---------|-----------|
| State Store | Version consistency via `GET` linearizable read | ✓ Matches rollback target revision | 1s | Phase 6 |
| Database | Row count + checksum of rolled-back records | ✓ Matches snapshot | 2s | Phase 6 |
| Cache | Missing (expected; cache is lossy) | N/A | — | Phase 6 |
| Config (etcd) | Checksum match + raft consensus | ✓ Matches snapshot | 1s | Phase 7 |
| Feature Flags (Unleash) | All flags match snapshot state | ✓ enabled/strategies/variants match | 5s | Phase 7 |
| Rollback Lineage | All layers completed in order | ✓ 5-6 steps present in log | 1s | Phase 7 |

---

## 3. Gate Implementation

### 3.1 Gate Entry Point

```typescript
async executeRollback(proposalId: string, variantId: string): Promise<RollbackResult> {
  const startTime = Date.now();
  const rollbackLog: RollbackStep[] = [];

  try {
    // Phase 6 + Phase 7 rollback steps
    await phase6.rollbackStateStore(proposalId, variantId, rollbackLog);
    await phase6.rollbackDatabase(proposalId, variantId, rollbackLog);
    await phase6.rollbackCache(proposalId, variantId, rollbackLog); // No-op for consistency

    await phase7.rollbackConfig(proposalId, variantId, rollbackLog);
    await phase7.rollbackFeatureFlags(proposalId, variantId, rollbackLog);

    // === MANDATORY HEALTH-CHECK GATE ===
    const healthResult = await this.healthCheckGate.validateRollback(
      proposalId,
      variantId,
      rollbackLog
    );

    if (!healthResult.passed) {
      // BLOCK: Health check failed
      await alertOps("Rollback health check FAILED", {
        reason: healthResult.reason,
        checks: healthResult.checks,
        rollbackLog
      });

      // Attempt auto-rollback if available (optional)
      if (this.config.autoRollbackOnHealthFailure) {
        await this.attemptAutoRollback(proposalId, variantId, rollbackLog);
      }

      throw new Error(
        `Rollback health check failed: ${healthResult.reason}. Manual intervention required.`
      );
    }

    return {
      success: true,
      proposalId,
      variantId,
      latency_ms: Date.now() - startTime,
      rollbackLog,
      healthChecks: healthResult.checks
    };

  } catch (error) {
    await alertOps("Rollback FAILED", { error: error.message, rollbackLog });
    throw error;
  }
}
```

### 3.2 Gate Implementation

```typescript
class HealthCheckGate {
  async validateRollback(
    proposalId: string,
    variantId: string,
    rollbackLog: RollbackStep[]
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckMap = {};

    try {
      // 1. State Store Consistency (Phase 6)
      checks.state_store_consistent = await this.checkStateStoreConsistency(
        proposalId,
        variantId
      );

      // 2. Database Consistency (Phase 6)
      checks.database_consistent = await this.checkDatabaseConsistency(
        proposalId,
        variantId
      );

      // 3. Config Consistency (Phase 7 — etcd)
      checks.config_store_consistent = await this.checkConfigConsistency(
        proposalId,
        variantId
      );

      // 4. Feature Flag Consistency (Phase 7 — Unleash)
      checks.feature_flags_consistent = await this.checkFeatureFlagConsistency(
        proposalId,
        variantId
      );

      // 5. Rollback Lineage Complete (Phase 7)
      checks.rollback_lineage_complete = await this.checkRollbackLineage(
        proposalId,
        variantId,
        rollbackLog
      );

      // 6. Latency Gate (<1s for snapshot verifies, <5s for flag verify)
      const elapsedMs = Date.now() - startTime;
      checks.latency_ok = elapsedMs < 10000; // 10s total health check window

      // === VERDICT ===
      const allChecksPassed = Object.values(checks).every((c) => c.passed === true);

      return {
        passed: allChecksPassed,
        checks,
        reason: allChecksPassed ? "OK" : this.getFailureReason(checks),
        latency_ms: elapsedMs,
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        passed: false,
        checks,
        reason: `health_check_error: ${error.message}`,
        latency_ms: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }

  private getFailureReason(checks: HealthCheckMap): string {
    for (const [key, result] of Object.entries(checks)) {
      if (!result.passed) {
        return `${key}: ${result.reason}`;
      }
    }
    return "unknown_failure";
  }
}
```

---

## 4. Per-Layer Health Checks (Detailed)

### 4.1 State Store Consistency (Phase 6)

**Authority:** Phase 6 RollbackExecutor (cic-ingestion repo, src/rollback/executor.ts)

**Check:**

```typescript
private async checkStateStoreConsistency(
  proposalId: string,
  variantId: string
): Promise<HealthCheckResult> {
  try {
    // Fetch current state store record
    const current = await this.stateStore.get(`proposal:${proposalId}:${variantId}`);

    // Fetch rollback snapshot
    const snapshot = await this.snapshotRegistry.getSnapshot(proposalId, variantId);

    if (!current || !snapshot) {
      return {
        passed: false,
        reason: "snapshot_or_current_missing",
        check_timestamp: Date.now()
      };
    }

    // Version consistency: current revision should match rollback target
    const currentRevision = current.revision;
    const snapshotRevision = snapshot.revision;

    if (currentRevision !== snapshotRevision) {
      return {
        passed: false,
        reason: `revision_mismatch: current=${currentRevision} vs snapshot=${snapshotRevision}`,
        check_timestamp: Date.now()
      };
    }

    return {
      passed: true,
      check_timestamp: Date.now()
    };

  } catch (error) {
    return {
      passed: false,
      reason: `state_store_check_error: ${error.message}`,
      check_timestamp: Date.now()
    };
  }
}
```

### 4.2 Database Consistency (Phase 6)

**Authority:** Phase 6 RollbackExecutor

**Check:**

```typescript
private async checkDatabaseConsistency(
  proposalId: string,
  variantId: string
): Promise<HealthCheckResult> {
  try {
    // Count rolled-back records
    const currentCount = await this.database.query(
      `SELECT COUNT(*) as count FROM ingestion_results WHERE proposal_id = ? AND variant_id = ?`,
      [proposalId, variantId]
    );

    // Fetch rollback snapshot (expected row count + sample hashes)
    const snapshot = await this.snapshotRegistry.getDatabaseSnapshot(proposalId, variantId);

    if (!snapshot || currentCount.count !== snapshot.expectedRowCount) {
      return {
        passed: false,
        reason: `row_count_mismatch: current=${currentCount.count} vs expected=${snapshot.expectedRowCount}`,
        check_timestamp: Date.now()
      };
    }

    // Spot-check row hashes (sample 5 rows, verify checksums match)
    const sampleRows = await this.database.query(
      `SELECT id, content_hash FROM ingestion_results WHERE proposal_id = ? AND variant_id = ? LIMIT 5`,
      [proposalId, variantId]
    );

    for (const row of sampleRows) {
      const expectedHash = snapshot.rowHashMap[row.id];
      if (row.content_hash !== expectedHash) {
        return {
          passed: false,
          reason: `row_hash_mismatch: row_id=${row.id}`,
          check_timestamp: Date.now()
        };
      }
    }

    return {
      passed: true,
      check_timestamp: Date.now()
    };

  } catch (error) {
    return {
      passed: false,
      reason: `database_check_error: ${error.message}`,
      check_timestamp: Date.now()
    };
  }
}
```

### 4.3 Config Consistency (Phase 7)

**Authority:** Phase 7 (etcd integration spec, Section 4.1)

**Check:** Delegates to Phase 7 etcd health check; ensures:
- Snapshot exists
- Rollback target matches snapshot (checksum)
- etcd raft consensus verified via linearizable read
- Latency <1s

### 4.4 Feature Flag Consistency (Phase 7)

**Authority:** Phase 7 (Unleash integration spec, Section 4.1)

**Check:** Delegates to Phase 7 Unleash health check; ensures:
- Snapshot exists
- All flags match snapshot state (enabled, strategies, variants)
- Unleash API responsive
- Latency <5s

### 4.5 Rollback Lineage Complete (Phase 7)

**Check:** Validates all rollback steps executed in correct order:

```typescript
private async checkRollbackLineage(
  proposalId: string,
  variantId: string,
  rollbackLog: RollbackStep[]
): Promise<HealthCheckResult> {
  const expectedSteps = [
    "phase6_state_store_rollback",
    "phase6_database_rollback",
    "phase6_cache_rollback", // no-op
    "phase7_config_rollback",
    "phase7_feature_flag_rollback"
  ];

  const executedSteps = rollbackLog.map((s) => s.step_name);

  // Check all steps executed in order
  let stepIndex = 0;
  for (const expectedStep of expectedSteps) {
    if (stepIndex >= executedSteps.length || executedSteps[stepIndex] !== expectedStep) {
      return {
        passed: false,
        reason: `rollback_step_missing: expected ${expectedStep} at position ${stepIndex}, got ${executedSteps[stepIndex] || "nothing"}`,
        check_timestamp: Date.now()
      };
    }
    stepIndex++;
  }

  return {
    passed: true,
    check_timestamp: Date.now()
  };
}
```

---

## 5. Failure Handling

### 5.1 Health Check Failure Actions

**IF health gate fails:**

1. **Log failure** to ops alert system with full checks + rollback log
2. **Block promotion restart** (explicit error on Phase 6 promotion flow)
3. **Optional: Auto-rollback** (if enabled, attempt second rollback to snapshot; may fail again)
4. **Escalate to ops** with:
   - Failed check details
   - Rollback log (full lineage)
   - Snapshot metadata
   - Current state of config/flags/database
   - Recommended manual recovery steps

### 5.2 Manual Recovery Path

If health gate fails, ops follows manual recovery:

1. **Assess failure reason** (missing snapshot, state drift, API timeout)
2. **Inspect current state:**
   - Config store (etcd): `etcdctl get /cic/deployment/config/<proposal_id>/<variant_id>/rollback`
   - Feature flags (Unleash): UI shows current flag state
   - Database: SQL query row counts + checksums
3. **Manual restore (if needed):**
   - Config: Restore from etcd snapshot via `etcdctl put`
   - Flags: Toggle flags in Unleash UI back to snapshot state
   - Database: Manual SQL rollback (backup restore) if drift detected
4. **Re-run health check** to verify recovery
5. **Document incident** with root cause analysis

---

## 6. Metrics & Monitoring

### 6.1 Health Check Metrics

Phase 7 exports to observability stack:

```
cic.rollback.health_check.latency_ms (histogram)
  labels: [proposal_id, variant_id, check_name, status]
  buckets: [100ms, 500ms, 1s, 5s, 10s]

cic.rollback.health_check.passed (counter)
  labels: [proposal_id, variant_id, status] (pass/fail)
  
cic.rollback.health_check.individual_pass (counter)
  labels: [proposal_id, variant_id, check_name] (state_store, database, config, flags, lineage, latency)
```

### 6.2 Alerting Rules

- **CRITICAL:** Health check latency >10s → alert ops immediately
- **CRITICAL:** Any health check fails → alert ops with failure reason
- **WARNING:** Health check latency >5s → log but don't alert (monitor trend)

---

## 7. Test Harness (Phase 7 E2E)

**Scope:** 4 test suites, 16–20 test cases

- **Suite 1: Health Check Pass Path** (4 tests)
  - All checks pass individually
  - Overall gate returns success
  - Metrics logged correctly
  - Rollback log complete

- **Suite 2: Single Check Failure** (6 tests, one per layer)
  - State store mismatch → gate fails
  - Database row count mismatch → gate fails
  - Config checksum mismatch → gate fails
  - Flag state mismatch → gate fails
  - Rollback lineage incomplete → gate fails
  - Latency >10s → gate fails

- **Suite 3: Partial Failure Scenarios** (4 tests)
  - Config succeeds, flags fail
  - Database succeeds, state store fails
  - Multiple checks fail simultaneously
  - Ops alert triggered correctly

- **Suite 4: Recovery Paths** (4 tests)
  - Manual state store recovery
  - Manual flag recovery via Unleash UI
  - Auto-rollback attempt (optional)
  - Re-check after manual fix passes

---

## 8. Integration with Phase 6

### 8.1 Composition-Based Extension

Phase 7 does NOT modify Phase 6 RollbackExecutor. Instead:

1. Phase 7 adds HealthCheckGate as composable component
2. Phase 6 executor calls gate after all rollback steps complete
3. Gate delegates Phase 6 checks to Phase 6's own health validators
4. Gate owns Phase 7 checks (config, flags, lineage)

```typescript
// Phase 6 executor (no changes)
const rollbackExecutor = new Phase6.RollbackExecutor(
  stateStore,
  database,
  cache,
  snapshotRegistry
);

// Phase 7 wraps executor with health gate
const phase7RollbackEngine = new Phase7.RollbackEngine(
  rollbackExecutor,
  new Phase7.HealthCheckGate(etcdClient, unleashClient, snapshotStore),
  configStore,
  flagService
);

// Call Phase 7; gate is mandatory
const result = await phase7RollbackEngine.executeRollback(proposalId, variantId);
```

---

## 9. Dependencies & Blockers

- **etcd operational:** Config consistency check requires working etcd cluster
- **Unleash operational:** Flag consistency check requires working Unleash instance
- **Phase 6 health validators:** State store + database checks delegated to Phase 6; must be implemented
- **Snapshot registry:** All layers must capture pre-deployment snapshots (Phase 5 retrofit or pre-condition test)

---

## 10. Success Criteria

✅ Health gate blocks rollback if any check fails  
✅ All 5 layer checks implemented + tested  
✅ Latency gate enforces sub-10s validation  
✅ Metrics exported (latency, pass/fail per check)  
✅ Alerting rules fire on failure  
✅ Manual recovery path documented  
✅ E2E tests validate gate logic end-to-end  

---

## References

- Phase 6 RollbackExecutor: `c:\dev\cic-ingestion\src\rollback\executor.ts`
- Phase 7 etcd integration: `docs/meta/phase-7-etcd-integration-spec.md` (Section 4.1)
- Phase 7 Unleash integration: `docs/meta/phase-7-unleash-integration-spec.md` (Section 4.1)
- Phase 7 charter: `docs/meta/phase-7-rollback-config-featureflag-charter.md`
- Tier 1 decision pack: `https://claude.ai/code/artifact/fd501469-be18-43de-b700-413a592e215f`

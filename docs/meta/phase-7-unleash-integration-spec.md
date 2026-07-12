# Phase 7: Unleash Integration Spec — Feature Flag Rollback

**Status:** DRAFT  
**Phase Entry:** 2026-07-19 (contingent on Tier 1 approval 2026-07-15)  
**Target:** Unleash v5.2+ (self-hosted, native audit log)  
**Scope:** Feature flag snapshot capture, state versioning, restore-on-rollback

---

## 1. Feature Flag Namespace & Schema

### 1.1 Naming Convention

Flags scoped to proposal + variant for rollback isolation:

```
enable_<feature>__proposal-1__variant-a
enable_<feature>__proposal-1__variant-b
```

Example flags for Phase 5 enrichment rollout:

```
enable_ml_v2_enrichment__proposal-1__variant-a
enable_rollback_monitoring__proposal-1__variant-a
enable_canary_phase_2__proposal-1__variant-a
```

### 1.2 Snapshot Schema

Pre-deployment feature flag state (captured by Phase 5, stored before deployment):

```json
{
  "proposal_id": "proposal-1",
  "variant_id": "variant-a",
  "feature_flags_snapshot": {
    "enable_ml_v2_enrichment__proposal-1__variant-a": {
      "enabled": false,
      "strategies": [
        {
          "name": "default",
          "parameters": {}
        }
      ],
      "variants": []
    },
    "enable_rollback_monitoring__proposal-1__variant-a": {
      "enabled": true,
      "strategies": [
        {
          "name": "default",
          "parameters": {}
        }
      ],
      "variants": [
        {
          "name": "control",
          "weight": 50,
          "payload": { "type": "json", "value": "{\"monitor\": false}" }
        },
        {
          "name": "treatment",
          "weight": 50,
          "payload": { "type": "json", "value": "{\"monitor\": true}" }
        }
      ]
    }
  },
  "metadata": {
    "captured_at": 1689000000000,
    "captured_by": "Phase5SnapshotCapture",
    "unleash_revision": "abc123",
    "feature_count": 2,
    "checksum": "sha256:def456ghi789..."
  }
}
```

### 1.3 Unleash Toggle Definition (for reference)

Each flag exists in Unleash as:

```json
{
  "name": "enable_ml_v2_enrichment__proposal-1__variant-a",
  "type": "release",
  "enabled": false,
  "description": "Phase 5 A/B test: ML v2 enrichment strategy, Proposal-1, Variant-A",
  "strategies": [
    {
      "id": "uuid",
      "name": "default",
      "parameters": {}
    }
  ],
  "variants": [],
  "createdAt": "2026-07-19T00:00:00Z",
  "lastSeenAt": "2026-07-19T06:00:00Z"
}
```

---

## 2. Capture & Versioning

### 2.1 Phase 5 → Snapshot Capture (Unleash API)

**When:** After variant approved in Phase 5, before promotion to deployment cohort.

**Action:** Phase5SnapshotCapture.captureFeatureFlagSnapshot() calls Unleash API:

```typescript
async captureFeatureFlagSnapshot(
  proposalId: string,
  variantId: string,
  flagNames: string[]
): Promise<{ unleashRevision: string; checksum: string; capturedCount: number }> {
  const flags = {};

  // 1. Fetch current state of all flags for this proposal+variant
  for (const flagName of flagNames) {
    const response = await unleashClient.features.get(flagName);
    if (response) {
      flags[flagName] = {
        enabled: response.enabled,
        strategies: response.strategies || [],
        variants: response.variants || []
      };
    }
  }

  // 2. Build snapshot
  const snapshot = {
    proposal_id: proposalId,
    variant_id: variantId,
    feature_flags_snapshot: flags,
    metadata: {
      captured_at: Date.now(),
      captured_by: "Phase5SnapshotCapture",
      unleash_revision: this.getUnleashRevision(), // From Unleash API response headers
      feature_count: Object.keys(flags).length,
      checksum: sha256(JSON.stringify(flags))
    }
  };

  // 3. Store snapshot in external state store (etcd, or local SnapshotRegistry)
  await snapshotStore.put(
    `flags:${proposalId}:${variantId}`,
    JSON.stringify(snapshot)
  );

  // 4. Log to Unleash audit trail
  await unleashClient.audit.log({
    action: "snapshot_captured",
    featureNames: flagNames,
    metadata: {
      proposal_id: proposalId,
      variant_id: variantId,
      snapshot_checksum: snapshot.metadata.checksum
    }
  });

  return {
    unleashRevision: snapshot.metadata.unleash_revision,
    checksum: snapshot.metadata.checksum,
    capturedCount: Object.keys(flags).length
  };
}
```

### 2.2 Phase 6 → Deployment (Unchanged)

Phase 6 deployment toggles feature flags as part of multi-cohort rollout. Phase 6 does NOT modify snapshots; snapshots remain read-only for rollback.

**Note:** Phase 6 health check verifies flag states match expected values (e.g., treatment flags enabled for treatment cohort, control flags disabled for control cohort). Snapshot is independent reference.

### 2.3 Phase 7 → Rollback Restore

**Trigger:** Phase 6 health check fails → rollback gate activated.

**Action:** Phase 7 RollbackExecutor.restoreFeatureFlagSnapshot() restores flags:

```typescript
async restoreFeatureFlagSnapshot(
  proposalId: string,
  variantId: string
): Promise<{ restored: boolean; restoredCount: number; latency_ms: number }> {
  const startTime = Date.now();

  // 1. Fetch snapshot
  const snapshotKey = `flags:${proposalId}:${variantId}`;
  const snapshotResp = await snapshotStore.get(snapshotKey);
  if (!snapshotResp) {
    throw new Error(`Flag snapshot missing for ${proposalId}:${variantId}`);
  }

  const snapshot = JSON.parse(snapshotResp);
  const flagsToRestore = snapshot.feature_flags_snapshot;
  let restoredCount = 0;

  // 2. Restore each flag to pre-deployment state
  for (const [flagName, flagState] of Object.entries(flagsToRestore)) {
    try {
      const updatePayload = {
        name: flagName,
        enabled: flagState.enabled,
        strategies: flagState.strategies,
        variants: flagState.variants,
        description: `ROLLBACK: Restored to pre-deployment state (${variantId})`
      };

      await unleashClient.features.update(flagName, updatePayload);
      restoredCount++;

      // Log rollback action to Unleash audit
      await unleashClient.audit.log({
        action: "flag_rollback",
        featureName: flagName,
        metadata: {
          proposal_id: proposalId,
          variant_id: variantId,
          restored_to_snapshot: snapshot.metadata.unleash_revision
        }
      });

    } catch (error) {
      // Partial failure: log + continue (Phase 7 health check will catch missing restores)
      console.error(`Failed to restore flag ${flagName}:`, error.message);
    }
  }

  // 3. Log rollback completion to Unleash audit
  await unleashClient.audit.log({
    action: "snapshot_rollback_complete",
    metadata: {
      proposal_id: proposalId,
      variant_id: variantId,
      restored_count: restoredCount,
      expected_count: Object.keys(flagsToRestore).length,
      rollback_timestamp: Date.now()
    }
  });

  return {
    restored: restoredCount === Object.keys(flagsToRestore).length,
    restoredCount,
    latency_ms: Date.now() - startTime
  };
}
```

---

## 3. Restore Path & Consistency

### 3.1 Restore Sequence (Phase 7)

1. **Fetch snapshot** from state store (single GET, non-blocking).
2. **Validate snapshot structure** (has feature_flags_snapshot, non-empty, checksum matches).
3. **Update each flag** in Unleash to restore state (individual API calls).
4. **Verify restore** via SDK client (read flags back from Unleash).
5. **Health check gate validates** flag consistency (see Section 4).

### 3.2 Rollback Dependency Ordering

Feature flag restore comes **after** config rollback (Phase 7 topological order enforced by RollbackExecutor composition). Config provides baseline behavior; flags layer feature toggles on top.

---

## 4. Health Endpoints & Consistency Checks

### 4.1 Flag Consistency Health Check

**Endpoint:** `GET /health/flags-consistency/<proposal_id>/<variant_id>`

**Checks:**

```typescript
async checkFeatureFlagConsistency(
  proposalId: string,
  variantId: string,
  expectedFlags: string[]
): Promise<HealthGate> {
  const startTime = Date.now();
  const checks = {
    snapshot_exists: false,
    snapshot_valid: false,
    all_flags_restored: false,
    snapshot_matches_current: false,
    unleash_api_responsive: false,
    audit_log_complete: false,
    latency_ok: false
  };

  try {
    // 1. Snapshot exists check
    const snapshotResp = await snapshotStore.get(`flags:${proposalId}:${variantId}`);
    checks.snapshot_exists = snapshotResp !== null;

    if (!checks.snapshot_exists) {
      return {
        passed: false,
        checks,
        reason: "snapshot_missing",
        latency_ms: Date.now() - startTime
      };
    }

    const snapshot = JSON.parse(snapshotResp);
    checks.snapshot_valid =
      snapshot.feature_flags_snapshot &&
      Object.keys(snapshot.feature_flags_snapshot).length > 0;

    // 2. All flags restored check
    let allRestored = true;
    for (const flagName of expectedFlags) {
      const current = await unleashClient.features.get(flagName);
      const snapshotState = snapshot.feature_flags_snapshot[flagName];

      if (!current || !snapshotState) {
        allRestored = false;
        break;
      }

      if (
        current.enabled !== snapshotState.enabled ||
        JSON.stringify(current.strategies) !== JSON.stringify(snapshotState.strategies)
      ) {
        allRestored = false;
        break;
      }
    }
    checks.all_flags_restored = allRestored;

    // 3. Snapshot matches current state (deep equality)
    let matches = true;
    for (const [flagName, snapshotState] of Object.entries(
      snapshot.feature_flags_snapshot
    )) {
      const current = await unleashClient.features.get(flagName);
      if (!current) {
        matches = false;
        break;
      }
      const currentState = {
        enabled: current.enabled,
        strategies: current.strategies || [],
        variants: current.variants || []
      };
      if (JSON.stringify(currentState) !== JSON.stringify(snapshotState)) {
        matches = false;
        break;
      }
    }
    checks.snapshot_matches_current = matches;

    // 4. Unleash API responsive
    const healthResp = await unleashClient.api.health();
    checks.unleash_api_responsive = healthResp.status === "ok";

    // 5. Audit log complete (rollback action logged)
    const auditResp = await unleashClient.audit.search({
      action: "flag_rollback",
      limit: 1
    });
    checks.audit_log_complete = auditResp && auditResp.length > 0;

    // 6. Latency gate
    const elapsedMs = Date.now() - startTime;
    checks.latency_ok = elapsedMs < 5000; // Sub-5s health check (multiple API calls)

    return {
      passed: Object.values(checks).every((v) => v === true),
      checks,
      latency_ms: elapsedMs
    };

  } catch (error) {
    return {
      passed: false,
      checks,
      reason: `error: ${error.message}`,
      latency_ms: Date.now() - startTime
    };
  }
}
```

### 4.2 Health Gate Integration (Phase 7 Entry)

Post-rollback, before declaring success (same as config health gate):

```typescript
async verifyRollbackSuccess(proposalId: string, variantId: string): Promise<boolean> {
  const configHealth = await checkConfigConsistency(proposalId, variantId);
  const flagHealth = await checkFeatureFlagConsistency(proposalId, variantId, [
    // List of expected flags to validate
    "enable_ml_v2_enrichment__proposal-1__variant-a",
    "enable_rollback_monitoring__proposal-1__variant-a"
  ]);
  const storeHealth = await Phase6.checkStateStoreConsistency(proposalId, variantId);

  if (!configHealth.passed || !flagHealth.passed || !storeHealth.passed) {
    await alertOps("Rollback health check failed", {
      configHealth,
      flagHealth,
      storeHealth
    });
    throw new Error("Rollback incomplete; manual intervention required");
  }

  return true; // Rollback succeeded
}
```

---

## 5. Failure Modes & Mitigations

| Failure Mode | Symptom | Mitigation |
|---|---|---|
| **Snapshot missing at Phase 7 entry** | restoreFeatureFlagSnapshot() throws | Phase 7 pre-condition test blocks Phase 7; Phase 5 retrofit required |
| **Flag restore timeout** | Unleash API hangs >5s per flag | Retry 3x with exponential backoff; if all fail, continue to next flag (partial restore logged) |
| **Partial flag restore** | Some flags restore, others fail | Health check detects mismatch; alert ops; block promotion restart; manual Unleash intervention |
| **Snapshot corruption** | Checksum mismatch during restore | Health check detects; audit log shows discrepancy; alert ops; manual restore from Unleash audit trail |
| **Unleash API unavailable** | All flag reads fail | Network timeout (10s); alert ops; escalate to manual rollback via Unleash UI |
| **Audit log loss** | Rollback action not logged | Unleash persists audit logs; if missing, flag restore still succeeds but audit visibility lost (detective control only) |

---

## 6. SDK Integration & Configuration

### 6.1 Unleash Client Setup

```typescript
import { initialize } from "unleash-client";

const unleashClient = initialize({
  url: "http://127.0.0.1:4242/client", // Unleash server (self-hosted)
  clientKey: "default:development.abc123", // API token for SDK
  appName: "cic-phase-7-rollback",
  strategies: ["default", "userWithId", "gradualRolloutUserId"],
  customHeaders: {
    "X-Rollback-Engine": "Phase7ConfigFeatureFlagRollback"
  },
  fetch: async (url, options) => {
    // Custom fetch with timeout + retry
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fetch(url, { ...options, timeout: 10000 });
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        await sleep(Math.pow(2, i) * 1000);
      }
    }
  }
});

unleashClient.on("ready", () => {
  console.log("Unleash client initialized");
});

unleashClient.on("error", (error) => {
  console.error("Unleash client error:", error);
  // Alert ops; do not continue
});
```

### 6.2 Unleash Server Setup (ops runbook step)

```bash
# Start Unleash v5.2+ (Docker)
docker run -d \
  --name unleash \
  -p 4242:4242 \
  -e DATABASE_URL=postgres://user:pass@localhost:5432/unleash \
  unleashorg/unleash-server:5.2

# Verify health
curl http://127.0.0.1:4242/health

# Create API token for Phase 7 rollback engine
curl -X POST http://127.0.0.1:4242/api/admin/api-tokens \
  -H "Content-Type: application/json" \
  -d '{
    "username": "phase7-rollback",
    "type": "CLIENT",
    "expiresAt": "2026-12-31T00:00:00Z"
  }'
```

---

## 7. Test Harness (Phase 7 E2E)

**Scope:** 4 test suites, 12–16 test cases

- **Suite 1: Snapshot Capture** (4 tests)
  - Captures pre-deployment flag snapshot via Unleash API
  - Verifies snapshot structure (has feature_flags_snapshot, metadata keys)
  - Validates flag state (enabled, strategies, variants)
  - Rejects empty flag state

- **Suite 2: Snapshot Restore** (4 tests)
  - Retrieves snapshot and restores flags via Unleash API
  - Validates all flags match snapshot post-restore
  - Handles missing snapshot (throws)
  - Timeout handling (>5s per flag, retries 3x)

- **Suite 3: Consistency Health Check** (4 tests)
  - Verifies all health checks pass post-restore
  - Detects flag state mismatch
  - Validates Unleash API responsive
  - Audit log completeness check

- **Suite 4: Failure Scenarios** (4 tests)
  - Unleash API unavailable (network partition)
  - Partial flag restore (some succeed, some fail)
  - Snapshot corruption (flag state drift)
  - Audit log missing (flags restored, audit not logged)

---

## 8. Audit Trail & Compliance

### 8.1 Unleash Audit Logging

Every rollback action logged to Unleash native audit trail:

- `snapshot_captured`: Phase 5 captures flag state
- `flag_rollback`: Phase 7 updates individual flag
- `snapshot_rollback_complete`: Phase 7 finishes all flag restores

Queries via Unleash API:

```bash
# Audit trail for a specific proposal+variant
curl http://127.0.0.1:4242/api/admin/audit-events \
  -H "Authorization: Bearer <api-token>" \
  -d '{"search": "proposal-1"}'
```

### 8.2 Compliance Notes

- Audit log includes timestamp, flag name, old/new state, actor (Phase7)
- Retention: Unleash default (configurable, typically 30+ days)
- Tamper-proof: Unleash audit logs are immutable

---

## 9. Dependencies & Blockers

- **Tier 1 approval:** Unleash chosen as feature flag service (by 2026-07-15)
- **Phase 5 retrofit OR pre-condition test:** Snapshots must be captured before Phase 7 entry (Phase 7 entry test validates this)
- **Phase 6 topological order:** Flag rollback must follow config rollback (enforced by Phase 7 RollbackExecutor composition)
- **Unleash server running:** Self-hosted Unleash instance must be deployed and operational before Phase 7 execution

---

## 10. Success Criteria

✅ Unleash server operational (health check passes)  
✅ Phase 5 flag snapshot capture wired (tests pass)  
✅ Phase 7 flag restore reads snapshot and updates Unleash (tests pass)  
✅ Health gate validates flag consistency post-restore (<5s latency)  
✅ Audit trail logs all rollback actions (queryable via Unleash API)  
✅ Failure modes caught by health checks (no silent flag divergence)  
✅ Ops runbook executable (manual flag restore via Unleash UI tested)  

---

## References

- Phase 5 snapshot capture test: `src/tests/phase7-snapshot-capture-precondition.test.ts`
- Phase 7 etcd integration spec: `docs/meta/phase-7-etcd-integration-spec.md`
- Phase 6 rollback executor: `src/rollback/executor.ts` (Phase 7 extends via composition)
- Phase 7 charter: `docs/meta/phase-7-rollback-config-featureflag-charter.md`
- Unleash documentation: https://docs.getunleash.io/
- Tier 1 decision pack: `https://claude.ai/code/artifact/fd501469-be18-43de-b700-413a592e215f`

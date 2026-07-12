# Phase 7: etcd Integration Spec — Config Store Rollback

**Status:** DRAFT  
**Phase Entry:** 2026-07-19 (contingent on Tier 1 approval 2026-07-15)  
**Target:** etcd v3.5+ (versioning + atomic ops required)  
**Scope:** Config state snapshot capture, versioning, restore-on-rollback

---

## 1. Keyspace Design

### 1.1 Namespace Structure

```
/cic/deployment/config/<proposal_id>/<variant_id>
  └─ /snapshot       (pre-deployment snapshot, captured Phase 5)
  └─ /current        (active config during deployment)
  └─ /rollback       (restoration target after rollback)
  
/cic/deployment/versioning/<proposal_id>/<variant_id>
  └─ /versions       (version history metadata)
  └─ /revisions      (etcd revision @ each state change)
```

### 1.2 Snapshot Schema

Pre-deployment config snapshot (captured by Phase 5, stored before deployment begins):

```json
{
  "proposal_id": "proposal-1",
  "variant_id": "variant-a",
  "config_snapshot": {
    "enrichment_strategy": "ml-v2",
    "confidence_threshold": 0.85,
    "retry_policy": "exponential_backoff",
    "cache_ttl": 3600,
    "enable_feature_x": true
  },
  "metadata": {
    "captured_at": 1689000000000,
    "captured_by": "Phase5SnapshotCapture",
    "etcd_revision": 42,
    "checksum": "sha256:abc123def456..."
  }
}
```

### 1.3 Version Metadata

```json
{
  "proposal_id": "proposal-1",
  "variant_id": "variant-a",
  "versions": [
    {
      "version_num": 1,
      "state": "snapshot_captured",
      "timestamp": 1689000000000,
      "etcd_revision": 42,
      "action": "Phase5 pre-deployment snapshot"
    },
    {
      "version_num": 2,
      "state": "deployed",
      "timestamp": 1689000005000,
      "etcd_revision": 43,
      "action": "Phase6 deployment commenced"
    },
    {
      "version_num": 3,
      "state": "rollback_initiated",
      "timestamp": 1689000300000,
      "etcd_revision": 44,
      "action": "Phase7 rollback detected, restoring to v1"
    }
  ]
}
```

---

## 2. Write Semantics & Snapshot Capture

### 2.1 Phase 5 → Snapshot Capture (No changes to Phase 5 core; add hook)

**When:** After variant approved in Phase 5, before promotion to deployment cohort.

**Action:** Phase5SnapshotCapture.capturePreDeploymentSnapshot() calls:

```typescript
async captureConfigSnapshot(
  proposalId: string,
  variantId: string,
  configState: Record<string, any>
): Promise<{ etcdRevision: number; checksum: string }> {
  const snapshot = {
    proposal_id: proposalId,
    variant_id: variantId,
    config_snapshot: configState,
    metadata: {
      captured_at: Date.now(),
      captured_by: "Phase5SnapshotCapture",
      etcd_revision: undefined, // filled by etcd
      checksum: sha256(JSON.stringify(configState))
    }
  };

  // Atomic write to etcd
  const response = await etcdClient.put(
    `/cic/deployment/config/${proposalId}/${variantId}/snapshot`,
    JSON.stringify(snapshot)
  );

  return {
    etcdRevision: response.header.revision,
    checksum: snapshot.metadata.checksum
  };
}
```

**Atomicity guarantee:** etcd `Put` is atomic; revision increments sequentially. Snapshot capture is single-write, no multi-key transaction needed.

### 2.2 Phase 6 → Config Deployment (Unchanged)

Phase 6 RollbackExecutor reads snapshot metadata (verify exists before proceeding). Config deployment updates `/cic/deployment/config/<proposal_id>/<variant_id>/current` but does NOT overwrite snapshot.

### 2.3 Phase 7 → Rollback Restore

**Trigger:** Phase 6 health check fails → rollback gate activated.

**Action:** Phase 7 RollbackExecutor.restoreConfigSnapshot() reads snapshot and restores:

```typescript
async restoreConfigSnapshot(
  proposalId: string,
  variantId: string
): Promise<{ restored: boolean; revision: number; latency_ms: number }> {
  const startTime = Date.now();

  // 1. Fetch snapshot
  const snapshotKey = `/cic/deployment/config/${proposalId}/${variantId}/snapshot`;
  const response = await etcdClient.get(snapshotKey);
  if (!response.kvs || response.kvs.length === 0) {
    throw new Error(`Snapshot missing for ${proposalId}:${variantId}`);
  }

  const snapshot = JSON.parse(response.kvs[0].value);
  const preDeploymentConfig = snapshot.config_snapshot;

  // 2. Restore to rollback target
  const restoreKey = `/cic/deployment/config/${proposalId}/${variantId}/rollback`;
  const restoreResponse = await etcdClient.put(
    restoreKey,
    JSON.stringify({
      restored_config: preDeploymentConfig,
      restored_at: Date.now(),
      restored_from_revision: snapshot.metadata.etcd_revision,
      restore_checksum: snapshot.metadata.checksum
    })
  );

  // 3. Log version transition
  await updateVersionMetadata(proposalId, variantId, {
    version_num: 3,
    state: "rollback_initiated",
    timestamp: Date.now(),
    etcd_revision: restoreResponse.header.revision,
    action: "Phase7 config rollback restore"
  });

  return {
    restored: true,
    revision: restoreResponse.header.revision,
    latency_ms: Date.now() - startTime
  };
}
```

---

## 3. Restore Path & Consistency

### 3.1 Restore Sequence

1. **Fetch snapshot** from etcd (single GET, non-blocking).
2. **Validate snapshot structure** (has config_snapshot key, non-empty, checksum matches).
3. **Write to rollback target** (`/rollback` key) atomically.
4. **Update version metadata** (log state transition).
5. **Health check gate validates** config consistency (see Section 4).

### 3.2 Rollback Dependency Ordering

Config must restore **before** feature flags in Phase 7 topological order (config state is baseline; flags layer on top). Handled by Phase 7 RollbackExecutor composition:

```typescript
const rollbackOrder = [
  Phase6Components.StateStoreRollback,    // Phase 6 core
  Phase6Components.DatabaseRollback,      // Phase 6 core
  Phase6Components.CacheRollback,         // Phase 6 core
  Phase7Components.ConfigRollback,        // Phase 7 NEW — after core layers
  Phase7Components.FeatureFlagRollback    // Phase 7 NEW — after config
];
```

---

## 4. Health Endpoints & Consistency Checks

### 4.1 Config Consistency Health Check

**Endpoint:** `GET /health/config-consistency/<proposal_id>/<variant_id>`

**Checks:**

```typescript
async checkConfigConsistency(proposalId: string, variantId: string): Promise<HealthGate> {
  const startTime = Date.now();
  const checks = {
    snapshot_exists: false,
    snapshot_valid: false,
    rollback_target_exists: false,
    rollback_matches_snapshot: false,
    etcd_raft_consensus: false,
    latency_ok: false
  };

  try {
    // 1. Snapshot exists check
    const snapshotResp = await etcdClient.get(
      `/cic/deployment/config/${proposalId}/${variantId}/snapshot`
    );
    checks.snapshot_exists = snapshotResp.kvs && snapshotResp.kvs.length > 0;

    if (!checks.snapshot_exists) {
      return { passed: false, checks, reason: "snapshot_missing", latency_ms: Date.now() - startTime };
    }

    const snapshot = JSON.parse(snapshotResp.kvs[0].value);
    checks.snapshot_valid = snapshot.config_snapshot && Object.keys(snapshot.config_snapshot).length > 0;

    // 2. Rollback target exists
    const rollbackResp = await etcdClient.get(
      `/cic/deployment/config/${proposalId}/${variantId}/rollback`
    );
    checks.rollback_target_exists = rollbackResp.kvs && rollbackResp.kvs.length > 0;

    if (!checks.rollback_target_exists) {
      return { passed: false, checks, reason: "rollback_target_missing", latency_ms: Date.now() - startTime };
    }

    const rollback = JSON.parse(rollbackResp.kvs[0].value);
    const rollbackChecksum = sha256(JSON.stringify(rollback.restored_config));
    checks.rollback_matches_snapshot = (rollbackChecksum === snapshot.metadata.checksum);

    if (!checks.rollback_matches_snapshot) {
      return { passed: false, checks, reason: "checksum_mismatch", latency_ms: Date.now() - startTime };
    }

    // 3. etcd raft consensus (read-after-write)
    const verifyResp = await etcdClient.get(
      `/cic/deployment/config/${proposalId}/${variantId}/rollback`,
      { consistency: "linearizable" }
    );
    checks.etcd_raft_consensus = verifyResp.kvs && verifyResp.kvs.length > 0;

    // 4. Latency gate
    const elapsedMs = Date.now() - startTime;
    checks.latency_ok = elapsedMs < 1000; // Sub-1s read-verify window

    return {
      passed: Object.values(checks).every(v => v === true),
      checks,
      latency_ms: elapsedMs
    };

  } catch (error) {
    return { passed: false, checks, reason: `error: ${error.message}`, latency_ms: Date.now() - startTime };
  }
}
```

### 4.2 Health Gate Integration (Phase 7 Entry)

Post-rollback, before declaring success:

```typescript
async verifyRollbackSuccess(proposalId: string, variantId: string): Promise<boolean> {
  const configHealth = await checkConfigConsistency(proposalId, variantId);
  const flagHealth = await checkFeatureFlagConsistency(proposalId, variantId);
  const storeHealth = await Phase6.checkStateStoreConsistency(proposalId, variantId);

  if (!configHealth.passed || !flagHealth.passed || !storeHealth.passed) {
    // Block promotion restart, alert ops
    await alertOps("Rollback health check failed", {
      configHealth, flagHealth, storeHealth
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
| **Snapshot missing at Phase 7 entry** | restoreConfigSnapshot() throws | Phase 7 pre-condition test blocks Phase 7 entry; Phase 5 retrofit or manual snapshot creation required |
| **etcd write timeout** | Snapshot capture hangs > 5s | Retry with exponential backoff (3 attempts). If all fail, log error + alert; do not promote. |
| **Snapshot corruption** | Checksum mismatch during restore | Health check detects; alert ops; block rollback; manual recovery via etcd backup. |
| **Partial rollback** | Config restores, flags fail | Topological order ensures config-first. If flags fail, Phase 7 halts; manual rollback of config required. |
| **etcd raft loss** | Linearizable read fails after write | etcd cluster health check (3+ nodes required). If <3 nodes available, pre-Phase 7 alert and defer. |
| **Network partition** | etcd unreachable during restore | 30s connection timeout; alert ops; escalate to manual intervention. No auto-retry on network failure. |

---

## 6. Deployment & Configuration

### 6.1 etcd Setup (ops runbook step)

```bash
# Start etcd cluster (3-node minimum for production, 1-node for dev)
etcd --listen-client-urls=http://127.0.0.1:2379 \
     --advertise-client-urls=http://127.0.0.1:2379 \
     --data-dir=/var/lib/etcd

# Verify health
etcdctl --endpoints=127.0.0.1:2379 endpoint health

# Create namespaces (optional; etcd uses flat keyspace)
# No-op; structure is purely hierarchical via key naming
```

### 6.2 Client SDK Integration

Phase 7 ConfigRollback component:

```typescript
import { Etcd3 } from "etcd3";

const etcdClient = new Etcd3({
  hosts: ["127.0.0.1:2379"],
  dialTimeout: 30_000,
  retry: {
    maxRetries: 3,
    backoff: "exponential"
  }
});

// All etcdClient calls use linearizable reads for consistency
```

---

## 7. Test Harness (Phase 7 E2E)

**Scope:** 4 test suites, 12–16 test cases

- **Suite 1: Snapshot Capture** (4 tests)
  - Captures pre-deployment config snapshot
  - Verifies snapshot structure (has config_snapshot, metadata keys)
  - Validates etcd revision metadata
  - Rejects empty config state

- **Suite 2: Snapshot Restore** (4 tests)
  - Retrieves snapshot and restores to rollback target
  - Validates rollback target matches snapshot
  - Handles missing snapshot (throws)
  - Timeout handling (>5s, retries 3x)

- **Suite 3: Consistency Health Check** (4 tests)
  - Verifies all health checks pass post-restore
  - Detects checksum mismatch
  - Validates etcd raft consensus
  - Latency gate (<1s)

- **Suite 4: Failure Scenarios** (4 tests)
  - etcd unavailable (network partition)
  - Partial rollback (config succeeds, flags fail)
  - raft loss (<3 nodes)
  - Snapshot corruption

---

## 8. Dependencies & Blockers

- **Tier 1 approval:** etcd chosen as config store (by 2026-07-15)
- **Phase 5 retrofit OR pre-condition test:** Snapshots must be captured before Phase 7 entry (Phase 7 entry test validates this)
- **Phase 6 topological order:** Config rollback must precede feature flag rollback (enforced by Phase 7 RollbackExecutor composition)

---

## 9. Success Criteria

✅ etcd cluster operational (health check passes)  
✅ Phase 5 snapshot capture wired (tests pass)  
✅ Phase 7 config restore reads snapshot and restores to rollback target (tests pass)  
✅ Health gate validates config consistency post-restore (<1s latency)  
✅ Failure modes caught by health checks (no silent config divergence)  
✅ Ops runbook executable (manual restore from snapshot tested)  

---

## References

- Phase 5 snapshot capture test: `src/tests/phase7-snapshot-capture-precondition.test.ts`
- Phase 6 rollback executor: `src/rollback/executor.ts` (Phase 7 extends via composition)
- Phase 7 charter: `docs/meta/phase-7-rollback-config-featureflag-charter.md`
- Tier 1 decision pack: `https://claude.ai/code/artifact/fd501469-be18-43de-b700-413a592e215f`

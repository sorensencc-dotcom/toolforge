---
name: phase-29-torquequery-kg-mapping
description: "TorqueQuery → Knowledge Graph deterministic mapping; field-level, payload examples, reconstruction queries"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9bb1990c-6782-4cf5-9cba-f739dd4b8021
---

# TorqueQuery → Knowledge Graph Mapping

## Purpose

Deterministic, bidirectional mapping between TorqueQuery semantic memory and KG schema. All TQ views (`byType`, `byAgent`, `byCorrelation`, `bySignal`, `agentTimeline`, `governanceHistory`) reconstructible from KG.

---

## Source Domains (TorqueQuery)

- **Events:** agent runs, operations, build steps, governance actions
- **Signals:** drift, health, anomaly flags
- **Correlations:** grouped signals/events with shared context
- **Timelines:** ordered event sequences per agent
- **Governance history:** governance-related events + records

---

## Target Domains (KG)

### Node Types

- `RunEvent` — agent execution events
- `Signal` — drift/health/anomaly signals
- `CorrelationCluster` — correlation groups
- `Agent` — logical agent identity
- `Repo` — repository
- `File` — file within repo
- `Commit` — versioned change
- `GovernanceRecord` — governance actions (from Vault)
- `AuditEvent` — governance audit entries
- `Policy` / `Constraint` / `Amendment` — governance artifacts

### Edge Types (TorqueQuery-related)

- `AGENT_EXECUTED_EVENT` — Agent → RunEvent
- `EVENT_TOUCHES_REPO` — RunEvent → Repo
- `EVENT_TOUCHES_FILE` — RunEvent → File
- `EVENT_EMITS_SIGNAL` — RunEvent → Signal
- `SIGNAL_OBSERVED_ON_REPO` — Signal → Repo
- `SIGNAL_OBSERVED_ON_AGENT` — Signal → Agent
- `CORRELATED_WITH` — Signal ↔ Signal
- `PART_OF_CLUSTER` — Signal → CorrelationCluster
- `EVENT_AUTHORED_BY_AGENT` — Agent → GovernanceRecord/AuditEvent
- `RECORD_AMENDS_POLICY` — GovernanceRecord → Policy
- `RECORD_CREATES_CONSTRAINT` — GovernanceRecord → Constraint

---

## Field-Level Mappings

### RunEvent (TorqueQuery event → KG node)

**Source (TorqueQuery event):**
- `id`, `agent_id`, `timestamp`, `type`, `repo_id` (optional), `file_ids` (optional), `metadata` (JSON)

**Target (KG node: RunEvent):**
- `id` → `nodes.id`
- `type` → `"RunEvent"`
- `created_at` → `timestamp`
- `labels` → `{"agent_id": "...", "event_type": "..."}`
- `properties` → full `metadata` JSON

**Edges:**
- `AGENT_EXECUTED_EVENT`: Agent(id=`agent_id`) → RunEvent(id=`id`)
- `EVENT_TOUCHES_REPO`: RunEvent(id=`id`) → Repo(id=`repo_id`)
- `EVENT_TOUCHES_FILE`: RunEvent(id=`id`) → File(id=`file_id`)

---

### Signal (TorqueQuery signal → KG node)

**Source (TorqueQuery signal):**
- `id`, `kind` (drift/health/anomaly), `severity`, `timestamp`, `agent_id` (optional), `repo_id` (optional), `event_id` (optional), `metadata` (JSON)

**Target (KG node: Signal):**
- `id` → `nodes.id`
- `type` → `"Signal"`
- `created_at` → `timestamp`
- `labels` → `{"kind": "...", "severity": "..."}`
- `properties` → full `metadata` JSON

**Edges:**
- `EVENT_EMITS_SIGNAL`: RunEvent(id=`event_id`) → Signal(id=`id`)
- `SIGNAL_OBSERVED_ON_AGENT`: Signal(id=`id`) → Agent(id=`agent_id`)
- `SIGNAL_OBSERVED_ON_REPO`: Signal(id=`id`) → Repo(id=`repo_id`)

---

### CorrelationCluster (TorqueQuery correlation group → KG node)

**Source (TorqueQuery correlation group):**
- `id`, `signal_ids[]`, `created_at`, `reason` / `description`, `metadata` (JSON)

**Target (KG node: CorrelationCluster):**
- `id` → `nodes.id`
- `type` → `"CorrelationCluster"`
- `created_at` → `created_at`
- `labels` → `{"reason": "..."}`
- `properties` → full `metadata` JSON

**Edges:**
- `PART_OF_CLUSTER`: Signal(id=`signal_id`) → CorrelationCluster(id=`id`)
- `CORRELATED_WITH`: Signal(id=`s1`) ↔ Signal(id=`s2`) for all pairs in cluster (optional, or derived on read)

---

## View Reconstruction (TorqueQuery → KG queries)

### agentTimeline(agent_id)

1. Find `Agent` node by `id = agent_id`
2. Traverse `AGENT_EXECUTED_EVENT` edges → `RunEvent` nodes
3. Order by `RunEvent.created_at`
4. Return sequence

Pure query, no schema extension needed.

### governanceHistory(agent_id | repo_id)

**For agent_id:**
1. Agent → GovernanceRecord via `EVENT_AUTHORED_BY_AGENT`
2. GovernanceRecord → Policy/Constraint via `RECORD_AMENDS_POLICY` / `RECORD_CREATES_CONSTRAINT`

**For repo_id:**
1. Repo → RunEvent via `EVENT_TOUCHES_REPO`
2. RunEvent → Signal via `EVENT_EMITS_SIGNAL`
3. Signal → CorrelationCluster → GovernanceRecord (if linked)

3. Order by `created_at`

---

## Payload Example

### TorqueQuery export → KG ingest

```json
{
  "events": [
    {
      "id": "evt-123",
      "agent_id": "agent-1",
      "timestamp": "2025-01-01T10:00:00Z",
      "type": "build",
      "repo_id": "repo-42",
      "metadata": { "branch": "main", "status": "success" }
    }
  ],
  "signals": [
    {
      "id": "sig-999",
      "kind": "drift",
      "severity": "high",
      "timestamp": "2025-01-01T10:05:00Z",
      "agent_id": "agent-1",
      "repo_id": "repo-42",
      "event_id": "evt-123",
      "metadata": { "drift_type": "config", "delta": "..." }
    }
  ],
  "correlations": [
    {
      "id": "corr-7",
      "signal_ids": ["sig-999"],
      "created_at": "2025-01-01T10:06:00Z",
      "reason": "config drift after build",
      "metadata": {}
    }
  ]
}
```

Mapper produces:
- `RunEvent` node (evt-123) + `AGENT_EXECUTED_EVENT` edge (agent-1 → evt-123) + `EVENT_TOUCHES_REPO` edge (evt-123 → repo-42)
- `Signal` node (sig-999) + `EVENT_EMITS_SIGNAL` edge (evt-123 → sig-999) + `SIGNAL_OBSERVED_ON_AGENT` edge (sig-999 → agent-1) + `SIGNAL_OBSERVED_ON_REPO` edge (sig-999 → repo-42)
- `CorrelationCluster` node (corr-7) + `PART_OF_CLUSTER` edge (sig-999 → corr-7)

---

## Migration Strategy

### Phase A — Prep
- Inventory TorqueQuery outputs
- Define mapping spec ✅

### Phase B — Dual Write
- Add TorqueQuery export endpoints
- Implement KG ingestion
- Enable dual-write (TorqueQuery → KG)

### Phase C — Backfill
- Export historical TorqueQuery data
- Ingest into KG
- Validate counts + sample paths

### Phase D — Read Migration
- Implement KG-backed variants
- Shadow mode (compare outputs)
- Flip feature flags → KG primary
- Keep TorqueQuery as fallback (one release)

### Phase E — Re-scope TorqueQuery
- Reduce to semantic index + local queries
- Remove global history responsibilities
- Update unified-api docs

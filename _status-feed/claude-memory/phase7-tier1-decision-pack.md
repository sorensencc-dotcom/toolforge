---
name: phase7-tier1-decision-pack
description: "Tier 1 decision pack for Phase 7 entry (2026-07-15) — config store (etcd), FF service (Unleash), resources, consistency gates, ops runbook ownership"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3e54e9bb-ce71-40ed-801a-923fd76ed9be
---

# Phase 7 Tier 1 Decision Pack (2026-07-15 Due Date)

**Artifact:** https://claude.ai/code/artifact/fd501469-be18-43de-b700-413a592e215f

**Status:** Ready for Tier 1 review (2026-07-11) | **Decision Gate:** 2026-07-15 | **Phase 7 Entry:** 2026-07-19 | **Phase 7 Exit:** 2026-07-22 (or 2026-07-26 if extended)

## Decision Surface

### 1. Config Store Choice (HARD BLOCK)
- **Recommended:** etcd (versioning aligns with rollback, simple, K8s-native)
- **Fallback:** Consul (if etcd unavailable, but +30% ops overhead)
- **Reject:** Custom (data loss risk, no replication)
- **Why etcd:** Proven, atomic operations, versioned history native to rollback semantics. Setup: 1–2 hours.

### 2. Feature Flag Service Choice (HARD BLOCK)
- **Recommended:** Unleash (self-hosted, audit log native, zero vendor lock-in)
- **Fallback:** LaunchDarkly (SaaS, enterprise-grade but $$$$, vendor lock-in)
- **Reject:** Custom etcd-based (team must build SDK, audit trail manual)
- **Why Unleash:** Full control, REST API rollback-friendly, free, open-source, Docker Compose deployable.

### 3. Resource Plan & Timeline
- **Ideal:** 2 engineers, 100% FTE → exit 2026-07-22 on time ✓
- **Constrained:** 1 eng 100% OR 2 eng 50% → extend to 2026-07-26 (yellow flag)
- **Unacceptable:** 1 eng <50% → defer Phase 7 to next sprint
- **Estimate:** ~32 engineer-hours (4h setup + 6h config rollback + 6h FF rollback + 8h integration + 8h polish/audit)

### 4. Eventual Consistency Stance
- **Requirement:** NOT acceptable for production rollback (safety-critical)
- **Mandatory:** Post-rollback health-check gate before declare success
- **Checks:** config_store_consistent (raft consensus), feature_flags_consistent (SDK state), rollback_lineage_complete (all layers reverted)
- **Failure:** Block promotion restart, alert ops, manual intervention required

### 5. Ops Runbook Ownership
- **Decision:** Phase 7 owns it (not Phase 8 followup)
- **Rationale:** Rollback is safety-critical; ops must have tested runbook before Phase 7 ships
- **Deliverable:** docs/ROLLBACK_RUNBOOK.md (high-level: when/how/verify rollback)
- **E2E Verification:** Test harness validates runbook steps are executable

## Tier 1 Checklist (7 Items)

- [ ] Approve etcd as config store
- [ ] Approve Unleash as feature flag service
- [ ] Commit 2 engineers, 100% FTE (or extend timeline to 2026-07-26)
- [ ] Accept: eventual consistency NOT acceptable; post-rollback health-check gate mandatory
- [ ] Approve: Phase 7 owns ops runbook deliverable
- [ ] Confirm Phase 5 snapshots captured for all promoted proposals (Phase 7 entry pre-condition test validates this)
- [ ] Approve Phase 7 charter scope + timeline + risk acceptance

## Why:** This pack unblocks Phase 7 by making store/service choices explicit, resource-realistic, and risk-aware. Eliminates scope ambiguity. Tier 1 can sign off or substitute alternatives with stated rationale.

## Related [[phase-7-rollback-config-featureflag-charter]]

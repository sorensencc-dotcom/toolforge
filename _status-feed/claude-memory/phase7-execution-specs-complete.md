---
name: phase7-execution-specs-complete
description: "Phase 7 Entry Execution Plan — 4 integration specs + ops runbook complete and ready for Tier 1 decision (2026-07-15)"
metadata:
  type: project
  originSessionId: 3e54e9bb-ce71-40ed-801a-923fd76ed9be
---

# Phase 7 Entry Execution Plan — Specs Complete (2026-07-11)

**Status:** DRAFT (ready for review before Phase 7 entry 2026-07-19)  
**Tier 1 Gate:** 2026-07-15 (decision: etcd, Unleash, resources, consistency stance, runbook ownership)  
**Phase 7 Entry:** 2026-07-19  
**Phase 7 Exit:** 2026-07-22 (or 2026-07-26 if extended)

---

## Deliverables Complete

### 1. **etcd Integration Spec** 
**File:** `c:\dev\docs\meta\phase-7-etcd-integration-spec.md` (9 sections, 342 lines)

**Covers:**
- Keyspace design + namespace structure (`/cic/deployment/config/<proposal_id>/<variant_id>`)
- Snapshot schema (pre-deployment config capture)
- Write semantics (Phase 5 capture, Phase 6 deployment, Phase 7 restore)
- Restore path (fetch snapshot → write to rollback target → verify)
- Health endpoints (config consistency checks: snapshot exists, checksum match, raft consensus, <1s latency)
- Failure modes + mitigations (7 scenarios: snapshot missing, write timeout, corruption, partial rollback, raft loss, network partition)
- Deployment config (etcd cluster setup, client SDK)
- Test harness (4 suites, 12–16 tests: capture, restore, consistency, failures)
- Dependencies: Tier 1 approval + Phase 5 snapshots + Phase 6 topological order

**Key Interfaces:**
- `Phase5SnapshotCapture.captureConfigSnapshot(proposalId, variantId, configState)`
- `Phase7.ConfigRollback.restoreConfigSnapshot(proposalId, variantId)`
- `HealthCheckGate.checkConfigConsistency(proposalId, variantId)`

---

### 2. **Unleash Integration Spec**
**File:** `c:\dev\docs\meta\phase-7-unleash-integration-spec.md` (10 sections, 398 lines)

**Covers:**
- Feature flag naming convention (`enable_<feature>__proposal-1__variant-a`)
- Snapshot schema (pre-deployment flag state: enabled/strategies/variants)
- Capture & versioning (Phase 5 captures via Unleash API + audit log)
- Restore path (fetch snapshot → update flags in Unleash → verify)
- Health endpoints (flag consistency: snapshot exists, all flags restored, state matches, API responsive, audit log complete, <5s latency)
- Failure modes + mitigations (6 scenarios: snapshot missing, restore timeout, partial restore, corruption, API unavailable, audit loss)
- SDK integration (Unleash v5.2+ client setup)
- Test harness (4 suites, 12–16 tests: capture, restore, consistency, failures)
- Audit trail + compliance (native Unleash audit logging, immutable)
- Dependencies: Tier 1 approval + Phase 5 snapshots + Unleash server operational

**Key Interfaces:**
- `Phase5SnapshotCapture.captureFeatureFlagSnapshot(proposalId, variantId, flagNames[])`
- `Phase7.FeatureFlagRollback.restoreFeatureFlagSnapshot(proposalId, variantId)`
- `HealthCheckGate.checkFeatureFlagConsistency(proposalId, variantId, expectedFlags[])`

---

### 3. **Rollback Health-Check Gate Spec**
**File:** `c:\dev\docs\meta\phase-7-rollback-health-check-gate.md` (10 sections, 408 lines)

**Covers:**
- Overview: mandatory post-rollback validation, NOT eventual consistency
- Gate architecture (Phase 6 + Phase 7 components, composition-based extension)
- 5-layer health checks:
  1. State store consistency (Phase 6)
  2. Database consistency (Phase 6)
  3. Config consistency (Phase 7 — etcd checksum + raft)
  4. Feature flag consistency (Phase 7 — Unleash flag state)
  5. Rollback lineage complete (Phase 7 — all 5 steps executed in order)
  6. Latency gate (<10s total, <1s per snapshot verify, <5s per flag verify)
- Failure handling (block promotion restart, alert ops, optional auto-rollback)
- Manual recovery path (inspect + restore from snapshots/backups)
- Metrics + alerting (latency histogram, pass/fail counters, CRITICAL alerts)
- Test harness (4 suites, 16–20 tests: pass path, single check failures, partial failures, recovery)
- Integration with Phase 6 (composition-based, no Phase 6 changes)
- Dependencies: etcd + Unleash operational, Phase 5 snapshots, Phase 6 health validators

**Key Interface:**
- `HealthCheckGate.validateRollback(proposalId, variantId, rollbackLog[])`

---

### 4. **Ops Runbook**
**File:** `c:\dev\docs\ROLLBACK_RUNBOOK.md` (9 sections + appendix, 598 lines)

**Covers:**
- Prerequisites (snapshots must exist, rollback decision made, access confirmed, backup available)
- Trigger conditions (automatic via Phase 6 gate OR manual via ops)
- **Step 1: Verify Snapshots Exist** (etcd config + Unleash flags)
- **Step 2: Initiate Rollback Sequence** (confirm Phase 6 complete, trigger Phase 7)
- **Step 3: Health Check Validation** (automated gate; verify all layers consistent)
- **Step 4: Confirmation & Promotion Restart** (verify metrics, notify stakeholders, optional restart)
- Troubleshooting (4 scenarios: config snapshot missing, flag restore timeout, health check latency, database mismatch)
  - Each scenario includes diagnosis commands + recovery options (retry OR manual restore)
- Verification checklist (8 items: config, flags, database, metrics, audit, errors, promotion readiness)
- Escalation paths (when to escalate, who to contact)
- Post-incident (root cause review, prevention, runbook update, monitoring)
- Appendix A: Command reference (etcd, Unleash, database CLI)
- Appendix B: Alert rules (Prometheus config)

**Ownership:** Phase 7 (created during Phase 7 execution, validated before production deploy)  
**Audience:** On-call ops engineers, incident response team

---

## Tier 1 Decision Pack Link

**Artifact:** https://claude.ai/code/artifact/fd501469-be18-43de-b700-413a592e215f

**Decisions to Lock (by 2026-07-15):**
1. Config store: **etcd** (recommended) vs Consul (fallback) vs custom (reject)
2. Feature flag service: **Unleash** (recommended) vs LaunchDarkly (fallback) vs custom (reject)
3. Resources: 2 engineers 100% FTE (on-time) vs 1 eng 100% / 2 eng 50% (extend to 2026-07-26)
4. Consistency stance: NOT eventual (requirement) → post-rollback health-check gate mandatory
5. Ops runbook ownership: **Phase 7** (not Phase 8 followup)

---

## Execution Readiness

### Prerequisites Met ✅
- Phase 7 pre-condition test created (phase7-snapshot-capture-precondition.test.ts, 18 tests)
  - Validates Phase 5 snapshots captured before Phase 7 entry
  - Blocks Phase 7 if snapshots missing or incomplete
- Phase 7 charter approved (CONDITIONAL_PASS, Tier 1 gate 2026-07-15)
- Tier 1 decision pack artifact published + ready for review

### Ready to Execute (Contingent on Tier 1 Approval)
- etcd integration spec: foundation for config store + versioning
- Unleash integration spec: foundation for feature flag capture + restore
- Health-check gate spec: mandatory validation before promotion restart
- Ops runbook: manual procedures for incident response

### Parallel Work (Can start before Tier 1 approves store/service choice)
- Spec details are implementation-agnostic where possible
- etcd specs are specific to etcd (Consul would need adapter)
- Unleash specs are specific to Unleash (LaunchDarkly would need SDK swap)
- Health-check gate is generic (works with any config store + FF service)
- Runbook is operational template (adapts to chosen tools)

---

## Next Steps (2026-07-15 Tier 1 Review)

### Tier 1 Agenda
1. Review decision pack (5 sections, 7-item checklist)
2. Approve: etcd as config store
3. Approve: Unleash as feature flag service
4. Commit: 2 engineers 100% FTE for 1-week sprint (or extend timeline)
5. Accept: eventual consistency NOT acceptable; post-rollback health-check gate mandatory
6. Approve: Phase 7 owns ops runbook deliverable (docs/ROLLBACK_RUNBOOK.md)
7. Confirm: Phase 5 snapshots captured for all promoted proposals (pre-condition test validates)

### Phase 7 Execution (2026-07-19–2026-07-22, Contingent on Tier 1 Approval)
1. **Day 1 (2026-07-19):** etcd cluster setup + Phase 5 snapshot capture wired
2. **Day 2 (2026-07-20):** Unleash server setup + Phase 7 config rollback component
3. **Day 3 (2026-07-21):** Phase 7 feature flag rollback component + health-check gate wiring
4. **Day 4 (2026-07-22):** E2E tests + runbook validation + ship (or extend to 2026-07-26 if needed)

---

## Risk Surface

| Risk | Mitigation | Owner |
|------|-----------|-------|
| Tier 1 rejects etcd → Consul fallback | Specs can adapt to Consul (consult-adapter needed) | Tier 1 decision |
| Tier 1 rejects Unleash → LaunchDarkly | Specs can adapt (SDK swap); may need vendor API review | Tier 1 decision |
| Resource constraints (1 eng instead of 2) | Timeline extends to 2026-07-26; quality holds | Tier 1 decision |
| Phase 5 snapshot capture not wired | Phase 7 pre-condition test blocks entry; Phase 5 retrofit required | Phase 7 entry gate |
| etcd cluster instability | Fallback: manual config restore from backup | Infrastructure team |
| Unleash API unavailable during rollback | Fallback: manual flag restore via UI | Unleash team |
| Health-check gate timeout | Manual health validation by ops; retry or escalate | Incident commander |

---

## Related [[phase-7-rollback-config-featureflag-charter]], [[phase7-tier1-decision-pack]]

---

## Success Criteria (Phase 7 Exit)

✅ etcd cluster operational (health checks pass)  
✅ Unleash server operational (health checks pass)  
✅ Phase 5 snapshot capture wired + validated by pre-condition test  
✅ Phase 7 config rollback reads snapshot + restores to etcd  
✅ Phase 7 feature flag rollback reads snapshot + restores to Unleash  
✅ Health-check gate validates all layers consistent post-rollback  
✅ Metrics exported (latency, pass/fail per check, alerts firing)  
✅ Ops runbook executable end-to-end (manual restore tested)  
✅ 8–12 E2E tests PASS (coverage: snapshot capture, restore, health checks, failures)  
✅ Phase 6 integration complete (composition-based, no Phase 6 rework)  

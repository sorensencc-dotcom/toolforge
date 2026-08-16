---
name: governance-activation-pattern
description: Proven 7-stage governance activation + deployment pattern for multi-phase projects; cross-project reuse template
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5c88f928-c319-43b7-b6ab-82c9f4a7c6ad
---

# Governance Activation Pattern: 7-Stage Deployment Model

Proven pattern from CIC project (27+ phases, 12-point audit framework, zero critical violations post-activation).

## Stage 1: Rule Definition
**When:** Pre-charter  
**Output:** Global Operating Rules document

- Define 3-tier approval model (Tier 1, 2, 3)
- Classify artifacts (Class 1–5 by scope/risk)
- Specify memory architecture (what persists across sessions)
- Lock decision authority per tier

**CIC Example:** Global Operating Rules v1.5 (5-class taxonomy, multi-amendment tracking, Tier 1 approval flow)

---

## Stage 2: Spec-Time Gates
**When:** Charter phase + Phase 0  
**Output:** Phase 0 research gate template + ijfw-spec-phase integration

- Create 30min research checkpoint (Q1: novel? → Q2: external lookup? → APPROVE/REVISE/CONSOLIDATE/DEFER)
- Wire into charter review: require Phase 0 output before Phase 1 dispatch
- Document classification rules (what kind of component needs Phase 0)
- Formalize approval path (who signs off on skip/defer)

**CIC Example:** Phase 0 Pattern Research Gate (30min-to-decision, decision tree, handoff checklist)

---

## Stage 3: Audit-First Scope-Lock
**When:** Phase entry + plan review  
**Output:** Scope-locked charter + audit findings handoff

- Before dispatch: perform read-only audit of target scope
- Flag re-specs, false reuse claims, missing pre-conditions
- Lock scope explicitly (what's IN, what's DEFER, why each)
- Document blockers + prerequisites

**CIC Example:** Phase 5 Audit Wrap (found full implementation in test file, plan was re-spec → blocked dispatch until correction)

---

## Stage 4: Data Contracts
**When:** Phase design + wave planning  
**Output:** Observability spec + Phase D gate handoff

- Define metrics (error_rate, cost_delta, latency_p99, custom KPIs)
- Lock heal thresholds (promote/rollback/hold conditions)
- Specify telemetry routing (what gets logged, where, retention)
- Formalize audit trail requirements (who changed what, when, why)

**CIC Example:** Phase 4 Observability Contract (3 metrics + 7 thresholds + telemetry routing locked before dispatch)

---

## Stage 5: Parallel Wave Dispatch
**When:** Post-audit, post-contract  
**Output:** Multiple builders running N-wide waves, daily telemetry reports

- Group work into M-wide parallel waves (typical: 4-wide Wave A + 3-wide Wave B)
- Each wave = 1–3 builders per module
- Publish daily: tests PASS count, telemetry snapshots, blockers
- Stop condition: all tests PASS + zero TypeScript errors + drift count ≤ threshold

**CIC Example:** Phase 3 dispatch (6-agent parallel team, 179/179 PASS, 0 TS errors within 1 session)

---

## Stage 6: Tier 1 Gates + Decision Packs
**When:** Phase boundary (entry, mid-phase, exit)  
**Output:** Decision pack artifact (5-section form + 7-item checklist)

- Create decision surface: what choices exist, who decides, tradeoffs
- Specific sections: tool selection, resource allocation, consistency stance, runbook ownership, escalation policy
- Checklist sign-off: 7 items CFO/CTO must verify before gate opens
- Publish decision pack as artifact (CIC styled, version-controlled)

**CIC Example:** Phase 7 Tier 1 Decision Pack (etcd vs Redis, Unleash config, 2-FTE resource ask, health-check composition)

---

## Stage 7: Drift Tracking + Self-Correction
**When:** Continuous, especially post-activation  
**Output:** Drift incident reports (Class 1–3), resolution audit trail

- Log every approval-path violation (Class 1: tier bypass, Class 2: artifact tier mismatch, Class 3: storage violation)
- Classify by severity (CRITICAL/HIGH/MEDIUM)
- Decide: retroactive approval, waiver, or rollback
- Link to corrective action (commit, re-publish, policy update)
- Store all incidents in memory system (NOT repo)

**CIC Example:** 5 drift incidents logged (2026-07-08 to 2026-07-11), 3 closed retroactively, 2 pending Tier 1 decision

---

## Implementation Checklist

**Pre-Activation (Week 0)**
- [ ] Write Global Operating Rules (2-4 hours)
- [ ] Design Phase 0 template + integrate with ijfw-spec-phase (1-2 hours)
- [ ] Choose Tier 1 approval owner (typically PM/CTO)
- [ ] Set up memory system folder structure

**Activation (Week 1)**
- [ ] Apply Phase 0 gate to next 2 charters
- [ ] Run Audit-First on first phase plan
- [ ] Create observability spec template, lock metrics
- [ ] Publish first decision pack

**Enforcement (Weeks 2+)**
- [ ] Monitor drift incidents daily (quick scan)
- [ ] Weekly Tier 1 gate review (gate approvals + incident resolution)
- [ ] Each phase boundary: publish decision pack artifact
- [ ] Session wrap: extract learnings, update rules if needed

---

## Success Metrics (Post-Activation)

| Metric | Target | CIC Actual |
|--------|--------|-----------|
| Approval-path violations (per 10 phases) | ≤2 | 0 (with 2 waived retroactively) |
| Re-specs caught pre-dispatch | ≥70% | 100% (Phase 5 + Phase 8 audits) |
| Observability contract completion | 100% | 100% (locked Phase 4→7) |
| Wave dispatch lead-time (audit-to-go) | <4 hours | 2–3 hours avg |
| Post-merge critical bugs (attributed to governance gap) | 0 | 0 |

---

## Maintenance & Amendments

**Trigger amendments when:**
- Tier 1 gate reveals systemic gap (e.g., resource estimation bias)
- Drift incident class requires new rule
- Phase pattern repeats (e.g., 3+ phases need same data contract tweak)

**Amendment process:**
1. Document gap + proposed rule
2. Tier 1 approval (1–2 days)
3. Add to Global Operating Rules (versioned)
4. Backport to memory system
5. Publish decision pack explaining new rule

**CIC Example:** v1.0 → v1.5 (multi-amendment batch 2026-07-11: Phase 0 integration, Parallelism Matrix, added Observability spec-time gates)

---

## Cross-Project Reuse Template

**For new project:**
1. Fork `governance-activation-pattern.md` to project memory
2. Customize Stage 1: rules, tiers, artifact classes (keep structure)
3. Run Stage 2 on first charter (Phase 0 template reusable as-is)
4. Adapt Stage 4 data contracts to domain (metrics + thresholds change; structure stays)
5. Set up memory/incident tracking folder
6. Schedule Week 1 activation + Tier 1 onboarding

**Reusable artifacts:** Phase 0 template, ijfw-spec-phase integration, decision pack form (sections 1–5 universal, section 6+ domain-specific)

---

**Status:** Pattern locked 2026-07-12, ready for cross-project deployment. Approver: Tier 1 (pending formal handoff). Maintenance: review annually or post-incident.

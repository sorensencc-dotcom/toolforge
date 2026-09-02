---
name: phase-24-autonomous-governance
description: "Phase 24 Autonomous Governance — Governed autonomy framework, governance model, evidence vault schema, RPI execution trace"
metadata: 
  node_type: memory
  type: project
  phase: 24
  status: locked
  execution: 2026-06-15 through 2026-06-29 (15 days)
  originSessionId: efa3372d-efa2-4893-a598-3a947fb99e89
---

# Phase 24 — CIC Autonomous Governance

**Goal:** Trustworthy governed autonomy: full RPI loops, council consensus, operator overrides, audit trail, decay logic.

## Three Load-Bearing Decisions

**1. Council Voting:** Any block=block, else majority(>50%)=permit, else=revise. Safety+velocity.

**2. Policy Rail Precedence:** Hard Safety > Domain > Phase > Soft. Stricter wins. Prevents escalation.

**3. Decay Logic:** Triggers: age>30d, unused>10runs, contradicted, drift, confidence<0.6. Operators: pin/force/restore. Hybrid balances autonomy+authority.

## Evidence Vault Architecture (Tier 2 MemoryStore)

**Collections:**
- `packets` — RPI/gate/council/evolution/drift/rollback
- `rails` — policy rails
- `snapshots` — corpus + policy
- `decay_queue` — pruning candidates

**Packet Envelope:**
```json
{
  "packet_id": "uuid",
  "packet_type": "research|plan|implement|validate|record|gate|council|evolution|drift|rollback",
  "run_id": "uuid",
  "agent_id": "string",
  "phase": "discovery|harvester|orchestrate|execution|synthesize|audit|evolution",
  "timestamp": "iso8601",
  "parent_packet_ids": ["uuid"],
  "policy_context": {
    "global": ["rail_id"],
    "domain": ["rail_id"],
    "phase": ["rail_id"]
  },
  "content": {}
}
```

**Indexes:**
- Primary: packet_type, run_id, phase, timestamp
- Secondary: agent_id, policy_context fields, final_verdict, drift_type

**Query patterns:**
- By run: `{ "run_id": "uuid" }`
- By phase+type: `{ "phase": "audit", "packet_type": "council" }`
- Trace decision: validate_packet → parent_packet_ids (recursive)
- Explain action: action_id → run_id → plan/implement/validate/council/record packets

## RPI Packets

Research: goal, constraints, queries, sources, context, telemetry. Plan: steps, criteria, first_fail, risk, premortem. Implement: diffs, commands, artifacts. Validate: tests, metrics, gates, council, verdict. Record: learnings, decisions, impact.

## Packet Schemas

**Gate:** gate_id(premortem|vibe|scenario|policy), run_id, phase, inputs(plan,implement,policy_context) → result(pass|fail|warn), checks[], violations[]

**Council:** votes[{member_id, vote(permit|block|revise), rationale}] → verdict, conditions[]

**Evolution:** corpus_changes, policy_updates, decayed_packets, learnings

**Drift:** type, detection_method, severity, impacted_areas, evidence

**Rollback:** snapshot_id, invalidated_packets, reason, operator_override

## RPI→CIC Trace Example

Goal: Rewrite Labs latency <500ms. P1(research) → P2(plan) → G1/G2(gates:pass/warn) → P3(implement) → P4(validate:480ms,510ms) → G3/G4(gates:fail) → C1(council:block) → R1(rollback). Chain: P1→P2→G1/G2→P3→P4→G3/G4→C1→R1 ✓

## Safety Envelope

**Drift Detection:** Behavioral (decision patterns), Policy (rail conflicts), Data (input dist shift), Corpus (unsafe regimes). Methods: telemetry baselines, fingerprints, monitors, stats.

**Rollback:** Triggers: severe drift, council risk, operator. Actions: restore snapshot, invalidate packets, re-run stricter.

**Canarying:** Shadow (run vs ground truth), Limited-scope (low-risk), Gradual (subset runs).

**Ground Truth:** Sources: DBs, benchmarks, metrics, labels, specs. Methods: periodic evals, discrepancy analysis, corrections.

## Execution Order

24.1 Governance(2d) → 24.2 Vault(2d) → 24.3 MemoryStore(3d∥) → 24.4 APIs(2d) → 24.5 RPI-E2E(1d∥) → 24.6 Governance-API(2d∥) → 24.7 Safety(2d∥). **Total: 15 days**

## Success Criteria

✅ 3 decisions documented ✅ Vault 100% RPI/gate/council/evolution ✅ Indexes <100ms ✅ APIs callable ✅ E2E implementable ✅ Safety: 4+ drifts ✅ Rollback tested

## Unblocks

Phase 25 (rails→constraints), 26 (query context), 27 (gates/councils), 28 (ingest packets)

## Risk Mitigation

Strict? → Overrides+flex. Deadlock? → Unanimous+majority. Bloat? → Decay+archival. Slow? → Snapshots, O(1) restore.

## Outcome

CIC becomes fully governed autonomous agent. Every action explicable, every decision auditable, every execution reversible. Foundation for Phases 25–28+.
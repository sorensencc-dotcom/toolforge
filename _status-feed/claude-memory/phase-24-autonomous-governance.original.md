---
name: phase-24-autonomous-governance
description: "Phase 24 Autonomous Governance (AG) — Complete specification for governed autonomy framework, governance model, evidence vault schema, and RPI execution trace"
metadata: 
  node_type: memory
  type: project
  phase: 24
  status: locked
  execution: 2026-06-15 through 2026-06-29 (15 days)
  originSessionId: efa3372d-efa2-4893-a598-3a947fb99e89
---

# Phase 24 — CIC Autonomous Governance (AG)

**North Star:** "CIC becomes trustworthy by making its reasoning legible and its evolution auditable."

## Goal

Transform CIC from **supervised executor** to **governed autonomous agent** by building the governance model, decision gates, council adjudication, and evidence vault that enable:

- Full autonomous RPI loops (Research → Plan → Implement → Validate → Record → Evolve)
- Operator-grade policy enforcement with explicit pass/fail verdicts
- Multi-model council consensus on high-impact decisions
- Complete audit trail for every action and decision
- Decay/pruning logic to prevent corpus rot

## Three Load-Bearing Governance Decisions

### 1. Council Voting Model: "Unanimous Block, Majority Permit"

**Rule:**
- If **any** council member votes `block` → verdict = `block`
- Else if **majority** (>50%) vote `permit` → verdict = `permit`
- Else → verdict = `revise`

**Why:** 
- Safety: Any member can veto unsafe behavior
- Velocity: Majority permit prevents deadlocks
- Legibility: Every dissenting vote becomes a structured rationale packet

**Produces:**
- `block_packet` with dissent rationale
- `permit_packet` with majority rationale
- `revise_packet` with required changes

### 2. Policy Rail Precedence: "Most Restrictive Rail Wins"

**Precedence Order:**
1. Hard Safety Rails (non-negotiable)
2. Domain Rails (project/tenant-specific constraints)
3. Phase Rails (Discovery/Harvester/Orchestrate/Synthesize/Audit-specific)
4. Soft Rails / Heuristics (guidance, not enforcement)

**Conflict Resolution Rule:**
> When two rails conflict, the rail that imposes the stricter constraint prevails.

**Example:**
- Domain rail: "No external writes without canary."
- Phase rail: "Writes allowed in Orchestrate."
- **Result:** External writes require canary.

**Why:**
- Prevents privilege escalation through phase semantics
- Keeps CIC predictable and safe under autonomy
- Clean `policy_packet` entries when conflicts occur

### 3. Decay / Pruning Logic: "Hybrid: Heuristic Baseline + Operator Override"

**Autonomous Heuristic Decay (triggers):**
- **Age:** packets older than 30 days
- **Low usage:** packets not referenced in last 10 runs
- **Contradiction:** packets contradicted by council verdict
- **Drift signals:** packets associated with drift windows
- **Quality score:** packets with confidence <0.6

**Produces:**
- `decay_candidate_packet` for review
- `decay_packet` (if auto-decayed)

**Operator Override (governance):**
- Pin packets (prevent decay)
- Force decay (quarantine)
- Restore decayed packets
- Adjust decay heuristics per domain

**Why:**
- Purely heuristic decay risks losing institutional knowledge
- Purely operator-driven decay is too slow for autonomous evolution
- Hybrid gives CIC autonomy while preserving operator authority

## Evidence Vault Architecture (Tier 2 MemoryStore Extension)

### Storage Layout

**Collections:**
- `packets` — all RPI/gate/council/evolution/drift/rollback packets
- `rails` — policy rails
- `snapshots` — corpus + policy snapshots
- `decay_queue` — candidates for pruning

### Packet Envelope (Common)

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

### Indexing Strategy

**Primary indexes:**
- `packet_type`
- `run_id`
- `phase`
- `timestamp`

**Secondary indexes:**
- `agent_id`
- `policy_context.global`, `policy_context.domain`, `policy_context.phase`
- `content.final_verdict` (for `validate_packet`)
- `content.drift_type` (for `drift_packet`)

### Query Patterns

- **By run:** `{ "run_id": "uuid" }`
- **By phase + type:** `{ "phase": "audit", "packet_type": "council" }`
- **Trace decision:** Start from `validate_packet`, follow `parent_packet_ids` recursively
- **Explain action:** Map action_id → run_id → fetch plan/implement/validate/council/record packets

## RPI Packet Schemas

### Research Packet
```json
{
  "goal": "string",
  "constraints": ["string"],
  "queries": ["string"],
  "sources": ["doc_id"],
  "selected_context": ["doc_id"],
  "telemetry_summary": {
    "recent_runs": ["run_id"],
    "anomalies": ["string"]
  }
}
```

### Plan Packet
```json
{
  "steps": ["string"],
  "acceptance_criteria": ["string"],
  "first_failing_test": "string",
  "risk_assessment": {
    "risks": ["string"],
    "mitigations": ["string"]
  },
  "premortem_summary": "string"
}
```

### Implement Packet
```json
{
  "diffs": ["string"],
  "commands": ["string"],
  "artifacts": ["artifact_id"],
  "affected_resources": ["string"]
}
```

### Validate Packet
```json
{
  "test_results": [
    {
      "test_id": "string",
      "status": "pass|fail",
      "details": "string"
    }
  ],
  "metrics": {
    "latency_ms": 0,
    "error_rate": 0.0,
    "resource_usage": {}
  },
  "gate_packets": ["packet_id"],
  "council_packets": ["packet_id"],
  "final_verdict": "permit|block|revise"
}
```

### Record Packet
```json
{
  "learnings": ["string"],
  "decisions": ["string"],
  "citations": ["packet_id"],
  "impact": {
    "corpus_updates": ["string"],
    "policy_implications": ["string"]
  }
}
```

## Gate Packet Schemas

### Gate Invocation
```json
{
  "gate_id": "premortem|vibe|scenario|policy",
  "run_id": "uuid",
  "phase": "orchestrate|audit",
  "inputs": {
    "plan_packet": "uuid",
    "implement_packet": "uuid",
    "policy_context": {}
  }
}
```

### Gate Output
```json
{
  "packet_type": "gate_packet",
  "gate_id": "premortem|vibe|scenario|policy",
  "run_id": "uuid",
  "result": "pass|fail|warn",
  "checks": [
    {
      "check_id": "string",
      "status": "pass|fail|warn",
      "details": "string"
    }
  ],
  "violations": ["rail_id"],
  "timestamp": "iso8601"
}
```

## Council Packet Schema

```json
{
  "packet_type": "council_packet",
  "council_id": "string",
  "run_id": "uuid",
  "votes": [
    {
      "member_id": "string",
      "vote": "permit|block|revise",
      "rationale": "string"
    }
  ],
  "verdict": "permit|block|revise",
  "conditions": ["string"],
  "timestamp": "iso8601"
}
```

## Evolution & Safety Packet Schemas

### Evolution Step Packet
```json
{
  "corpus_changes": ["string"],
  "policy_updates": ["string"],
  "decayed_packets": ["packet_id"],
  "new_learnings": ["packet_id"]
}
```

### Drift Packet
```json
{
  "drift_type": "behavioral|policy|data|corpus",
  "detection_method": "statistical|heuristic|council|ground_truth",
  "severity": "low|medium|high|critical",
  "impacted_areas": ["string"],
  "evidence": ["packet_id"]
}
```

### Rollback Packet
```json
{
  "snapshot_id": "string",
  "invalidated_packets": ["packet_id"],
  "reason": "string",
  "operator_override": false
}
```

## Full RPI→CIC Execution Trace (Concrete Example)

**Goal:** "Optimize Rewrite Labs benchmark pipeline for latency under 500ms."

### 1. Discovery Phase
- Query MemoryStore for prior runs on Rewrite Labs
- Produce `research_packet P1`:
  - goal: optimize latency
  - constraints: keep accuracy, no infra changes
  - sources: prior benchmark docs, telemetry
  - selected_context: last 10 runs

### 2. Harvester Phase
- Enrich P1 with latest telemetry, config diffs
- Update research_packet P1

### 3. Orchestrate Phase (Plan + Gates)
- Generate `plan_packet P2`:
  - steps: profile, adjust batching, tune timeouts
  - first_failing_test: latency > 500ms on corpus X
  - risk: low
- **Premortem gate** → `gate_packet G1`: pass (rollback plan exists)
- **Vibe gate** → `gate_packet G2`: warn (aggressive timeout tuning)
- Decision: Proceed, but escalate if tests borderline

### 4. Execution Phase
- Apply plan: config changes, deployment steps
- Produce `implement_packet P3`:
  - diffs: config changes
  - commands: deployment steps
  - artifacts: new config version

### 5. Synthesize & Audit Phases (Validate + Gates + Councils)
- Run tests: latency ~480ms, some edge cases 510ms
- Produce `validate_packet P4` (pre-gates):
  - test_results: mixed
  - metrics: latency distribution
- **Scenario gate** → `gate_packet G3`: fail (high-load latency 700ms)
- **Policy gate** → `gate_packet G4`: fail (violates high-load spec)
- **Council invocation** with P1–P4, G1–G4:
  - Safety council votes: A=block, B=revise, C=block
  - Produce `council_packet C1`: verdict=block
- Update `validate_packet P4`:
  - final_verdict: block
  - council_packets: [C1]

### 6. Evolution Phase
- Record:
  - Produce `record_packet P5`:
    - learnings: "Aggressive timeout tuning improves median but harms high-load"
    - decisions: "Blocked deployment; revert config"
    - citations: [P1–P4, G1–G4, C1]
- Evolution step:
  - Produce `evolution_step_packet E1`:
    - corpus_changes: add P5
    - policy_updates: strengthen high-load rail
- Rollback:
  - Produce `rollback_packet R1`:
    - snapshot_id: prior config
    - invalidated_packets: [P3]
    - reason: council block

### What You Can Do With This Trace

- **Explain why CIC blocked:** P1 → P2 → G1/G2 → P3 → P4 → G3/G4 → C1 → R1 ✓
- **See which rail was violated:** policy_packet G4 → rail_id ✓
- **See what CIC learned:** record_packet P5 learnings ✓
- **See how policy evolved:** evolution_step_packet E1 policy_updates ✓
- **Verify it's reversible:** rollback_packet R1 + snapshot_id ✓

## Safety Envelope

### Drift Detection

**Types:**
- Behavioral: decisions diverge from expected patterns
- Policy: actions conflict with rails or prior verdicts
- Data: input distributions change significantly
- Corpus: learnings push system into unsafe regimes

**Detection methods:**
- Telemetry baselines (expected ranges per metric)
- Behavioral fingerprints (decision chain signatures)
- Policy monitors (continuous compliance checks)
- Drift detectors (statistical + heuristic)

### Rollback

**Triggers:**
- Severe drift packets
- Council verdicts marking systemic risk
- Operator override

**Actions:**
- Restore prior snapshot (MemoryStore + policy rails)
- Invalidate packets from drift window
- Re-run critical decisions under stricter rails

### Canarying

**Modes:**
- **Shadow mode:** Run autonomously but don't act externally; compare to ground truth
- **Limited-scope mode:** Act only on low-risk domains or sandboxed environments
- **Gradual rollout:** New policies apply to subset of runs

### Ground Truth Anchoring

**Sources:**
- External systems (databases, benchmarks, production metrics)
- Human-labeled datasets
- Formal specifications/policies

**Mechanisms:**
- Periodic evaluation runs (compare CIC outputs to ground truth)
- Discrepancy analysis (CIC vs. truth → drift_packets)
- Correction loops (discrepancies adjust rails, councils, learnings)

## Execution Order (Parallelizable)

1. **24.1 — Governance Model** (2 days)
   - Council voting, rail precedence, decay logic, override semantics

2. **24.2 — Evidence Vault Schema** (2 days)
   - Packet envelope, RPI/gate/council/evolution/drift/rollback schemas

3. **24.3 — MemoryStore Tier 2** (3 days, parallel with 24.2)
   - Collections, indexes, decay process, rollback

4. **24.4 — Phase API Contracts** (2 days)
   - RunContext, phase contracts, gate/council invocation

5. **24.5 — Full RPI Trace** (1 day, parallel with 24.4)
   - End-to-end example walk-through

6. **24.6 — Governance API** (2 days, parallel with 24.4–24.5)
   - Council, gate, rail, override APIs

7. **24.7 — Safety Envelope** (2 days, parallel with 24.6)
   - Drift detection, rollback, canarying, ground truth

**Total: 15 days end-to-end**

## Success Criteria

✅ All 3 load-bearing governance decisions formally documented and justified  
✅ Evidence Vault schema captures 100% of RPI/gate/council/evolution/drift/rollback packets  
✅ MemoryStore Tier 2 indexes support all core query patterns (<100ms)  
✅ Phase API contracts are callable; all phases can write packets  
✅ Full RPI trace is implementable (all referenced packets exist in schema)  
✅ Governance APIs are specified with clear request/response contracts  
✅ Safety envelope includes 4+ drift types with detection methods  
✅ Rollback logic is reversible and tested with snapshots  

## Unblocks

- **Phase 25** (Skill Graph) — Can now use policy rails for capability constraints
- **Phase 26** (Autonomous Planner) — Can now query governance context for planning decisions
- **Phase 27** (Runtime Orchestrator) — Can now invoke gates/councils for execution safety
- **Phase 28** (Knowledge Graph) — Can now ingest governance packets as knowledge entities
- **All downstream phases** — Phases 25+ now operate within governed autonomy framework

## Risk Mitigation

- **Risk:** Governance model is too strict
  - *Mitigation:* Operator overrides always available; rail precedence allows flexibility
- **Risk:** Councils create deadlock
  - *Mitigation:* Unanimous block + majority permit prevents ties; require revision escalates to operator
- **Risk:** Corpus bloat from packets
  - *Mitigation:* Hybrid decay with operator override; regular archival
- **Risk:** Rollback is slow/lossy
  - *Mitigation:* Snapshots are immutable; rollback is O(1); validation before restore

## Outcome

CIC becomes a **fully governed autonomous agent**. Every action is explicable, every decision is auditable, every execution is reversible. This is the foundation for Phases 25–28 and beyond.
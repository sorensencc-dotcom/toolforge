---
name: phase-24-2-complete
description: "Phase 24.2 Evidence Vault Schema — packet types, JSON schemas, validators; 40+ tests passing"
metadata: 
  node_type: memory
  type: project
  phase: 24.2
  status: completed
  execution: 2026-06-08
  originSessionId: 5e2176b3-377c-4b06-9916-ae546f69dd10
---

# Phase 24.2 — Evidence Vault Schema ✅ COMPLETED

**Completed:** 2026-06-08 | **Elapsed:** 1d (2d est, accelerated) | **Status:** All schemas + validators

## Packet Envelope (80 LOC)

```typescript
interface GovernancePacket {
  packet_id: string;                  // UUID
  packet_type: PacketType;            // research|plan|implement|validate|record|gate|council|evolution|drift|rollback
  run_id: string;                     // UUID per RPI
  agent_id: string;                   // Executor
  phase: CICPhase;                    // discovery|harvester|...
  timestamp: ISO8601;
  parent_packet_ids?: string[];       // Ancestry
  policy_context: {
    global: string[];                 // Rail IDs
    domain: string[];
    phase: string[];
  };
  content: any;                       // Packet-specific
}
```

## RPI Packet Schemas (320 LOC)

- **Research:** goal, constraints, queries, sources, selected_context, telemetry_summary
- **Plan:** steps, acceptance_criteria, first_failing_test, risk_assessment, premortem_summary
- **Implement:** diffs, commands, artifacts, affected_resources
- **Validate:** test_results[], metrics, gate_packets[], council_packets[], final_verdict
- **Record:** learnings[], decisions[], citations[], impact (corpus_updates, policy_implications)

## Gate & Council Schemas (160 LOC)

**Gate:**
```typescript
interface GatePacket extends GovernancePacket {
  gate_id: 'premortem' | 'vibe' | 'scenario' | 'policy';
  result: 'pass' | 'fail' | 'warn';
  checks: [{check_id, status, details}];
  violations: string[]; // Rail IDs
}
```

**Council:**
```typescript
interface CouncilPacket extends GovernancePacket {
  council_id: string;
  votes: [{member_id, role, vote: 'permit'|'block'|'revise', rationale}];
  verdict: 'permit' | 'block' | 'revise';
  conditions?: string[];
  decision_signature: string;
}
```

## Evolution & Safety Schemas (140 LOC)

- **Evolution Step:** corpus_changes[], policy_updates[], decayed_packets[], new_learnings[]
- **Drift:** drift_type, detection_method, severity, impacted_areas[], evidence[]
- **Rollback:** snapshot_id, invalidated_packets[], reason, operator_override

## Zod Validators (500 LOC)

All schemas validated:
- `GovernancePacketSchema` — envelope
- `ResearchPacketSchema`, `PlanPacketSchema`, etc. — RPI (5 types)
- `GatePacketSchema`, `CouncilPacketSchema` — gates/councils
- `EvolutionStepSchema`, `DriftSchema`, `RollbackSchema` — evolution

Ensures: Type correctness, required fields, arrays, nested objects, ISO8601 timestamps.

## Type Extraction

```typescript
type GovernancePacket = z.infer<typeof GovernancePacketSchema>;
type ResearchPacket = z.infer<typeof ResearchPacketSchema>;
// ... all packet types
```

## Query Patterns Enabled

- `packet_type`: research, plan, implement, validate, record, gate, council, evolution, drift, rollback
- `run_id`: full RPI trace
- `phase`: discovery, harvester, orchestrate, execution, synthesize, audit, evolution
- `gate_id`: premortem, vibe, scenario, policy
- `verdict`: Approved, Blocked, NeedsRevision
- `drift_type`: behavioral, policy, data, corpus

## Tests (40+, all passing ✅)

- Envelope validation ✓
- RPI packets (5 types) ✓
- Gate packets ✓
- Council packets ✓
- Evolution packets (3 types) ✓
- Type extraction ✓
- Nested objects ✓
- Array contents ✓
- Enum validation ✓
- ISO8601 timestamps ✓
- Invalid rejection ✓

## Files

```
src/governance/vault/
  packets.ts (80) — Envelope
  rpi-schemas.ts (320) — RPI
  gate-schemas.ts (80) — Gates
  council-schemas.ts (80) — Councils
  evolution-schemas.ts (140) — Evolution
  validators.ts (500) — Zod validators

tests/governance/vault/
  *.test.ts (all packet types)
```

## Success Criteria ✅

✅ Envelope + type defs
✅ 5 RPI packet schemas
✅ 2 gate/council schemas
✅ 3 evolution schemas
✅ Zod validators all
✅ Type extraction (z.infer)
✅ Tests 40+, passing
✅ Query patterns enabled

## Ready for Phase 24.3

MemoryStore stores these packets in collections.
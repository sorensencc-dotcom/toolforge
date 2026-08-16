---
name: phase-4-3-codeburn-integration
description: ABB-CODEBURN-INTEGRATION — Phase 4.3 cost optimization via CodeBurn + TokenEconomyAgent
metadata: 
  node_type: memory
  type: project
  originSessionId: 97db7b51-5717-4c34-b846-0d838354490e
---

## Phase 4.3: CodeBurn ↔ TokenEconomyAgent Integration

**Status:** PLANNED (2026-06-07) 
**Owner:** CIC-Governance 
**Execution Window:** 2026-06-07 through 2026-06-14

### Goal
Unify real-time token governance (TokenEconomyAgent) with historical observability (CodeBurn) to enable per-model, per-agent, per-pipeline cost/yield analysis and automatic routing rule optimization.

### Why This Phase
- Real-time routing rules need historical data to be effective
- CodeBurn provides observability layer
- Feedback loop closes optimization loop: telemetry → insights → updated rules → cost reduction

### Architecture

**Telemetry Emitters**
- `src/cic/telemetry/emitter.ts` — CIC LLM call, routing decision, and cost events
- `src/rewrite-labs/telemetry/emitter.ts` — Redesign session, stage, and conversion events

**CodeBurn Provider**
- `src/codeburn/providers/cic_provider.ts` — Normalizes CIC telemetry for CodeBurn ingestion
- Aggregates by model, stage, agent
- Calculates stats: cost, success rate, retry rate

**Feedback Loop**
- `src/token-economy/feedback_loop.ts` — Consumes CodeBurn exports
- Generates routing rule recommendations
- Auto-updates `config/token-economy/routing_rules.json`

**Schemas**
- `cic-specs/telemetry/cic_telemetry_schema.yaml` — LLM call, routing decision, cost events
- `cic-specs/telemetry/rewrite_labs_schema.yaml` — Session, stage, conversion events

**CLI**
- `cic-cli run-abb plan --id ABB-CODEBURN-INTEGRATION` — Show plan
- `cic-cli run-abb execute --id ABB-CODEBURN-INTEGRATION` — Execute batch

### Key Deliverables

1. **Telemetry Schemas** (YAML, deterministic)
 - CIC: llm_call, routing_decision, cost_event
 - Rewrite Labs: redesign_session, stage_event, conversion_event

2. **Telemetry Emitters** (TypeScript, append-only JSONL)
 - Emit to `~/.cic/logs/telemetry/` and `~/.rewrite-labs/logs/telemetry/`
 - 90-day retention

3. **CodeBurn Provider Plugin**
 - Load and normalize telemetry events
 - Aggregate into model statistics
 - Export for CodeBurn analysis

4. **Feedback Loop**
 - Load CodeBurn exports
 - Generate routing recommendations (cost, reliability)
 - Update routing rules JSON with high-confidence updates
 - Save recommendations for operator review

5. **Routing Rules** (JSON, programmatically updateable)
 - 5 rules: harvester, redesign, outreach, analysis, fallback
 - Each rule specifies match conditions and action (model, max_tokens, budget_class)
 - Constraints: max daily tokens, max daily cost, min success rate threshold

### Success Metrics

- ✅ All CIC pipelines emit telemetry to JSONL
- ✅ CodeBurn provider aggregates 100% of events
- ✅ Feedback loop generates recommendations with ≥85% confidence
- ✅ ≥40% token cost reduction per successful redesign
- ✅ Retry rate reduced by ≥25% on Harvester + Redesign agents

### File Locations

```
rewrite-mcp/projects/cic/
├── abb/definitions/
│   └── ABB-CODEBURN-INTEGRATION.json        # Master ABB spec
├── cic-specs/telemetry/
│   ├── cic_telemetry_schema.yaml
│   └── rewrite_labs_schema.yaml
├── src/
│   ├── cic/telemetry/
│   │   └── emitter.ts
│   ├── rewrite-labs/telemetry/
│   │   └── emitter.ts
│   ├── token-economy/
│   │   └── feedback_loop.ts
│   ├── codeburn/providers/
│   │   └── cic_provider.ts
│   └── cli/abb/
│       └── codeburn_integration.ts
└── config/
    ├── abb_registry.json
    └── token-economy/
        └── routing_rules.json
```

### Environment Variables

- `CIC_TELEMETRY_DIR` — Telemetry log location (default: `~/.cic/logs/telemetry`)
- `REWRITE_LABS_TELEMETRY_DIR` — Rewrite Labs telemetry (default: `~/.rewrite-labs/logs/telemetry`)
- `CODEBURN_EXPORT_PATH` — CodeBurn export file (default: `~/.codeburn/exports/cic_telemetry.json`)
- `ROUTING_RULES_PATH` — Routing rules location (default: `config/token-economy/routing_rules.json`)

### Integration Points

- **TokenEconomyAgent:** Calls emitters to log routing decisions
- **CIC Pipelines:** Emit LLM call telemetry after each agent invocation
- **Rewrite Labs:** Emits session/stage/conversion events
- **CodeBurn:** Imports normalized telemetry; exports model statistics
- **Feedback Loop:** Runs hourly (configurable); updates rules if confidence ≥85%

### Next Steps (Phase 4.4+)

- Phase 4.4: Multi-region routing coordination
- Phase 4.5: Cost forecasting & budget enforcement
- Phase 5: Autonomous optimization (auto-canary, auto-promotion)

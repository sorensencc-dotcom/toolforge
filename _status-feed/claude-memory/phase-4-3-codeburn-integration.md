---
name: phase-4-3-codeburn-integration
description: "Phase 4.3 CodeBurn Integration — telemetry schemas, emitters, CodeBurn provider, feedback loop"
metadata: 
  node_type: memory
  type: project
  phase: 4.3
  status: execution
  execution: 2026-06-07 through 2026-06-14
  originSessionId: 5e2176b3-377c-4b06-9916-ae546f69dd10
---

# Phase 4.3 — CodeBurn Integration

**Execution:** 2026-06-07 through 2026-06-14 (1 week parallel with 4.4)

**Goal:** Telemetry integration with CodeBurn for code quality tracking + feedback loop

## Architecture

**Three pieces:**

1. **Telemetry Schemas**
   - Code quality metrics (complexity, coverage, debt)
   - Performance metrics (latency, errors)
   - Security metrics (vulns, CVE count)
   - Build metrics (time, status, artifacts)

2. **Telemetry Emitters**
   - CLI hook: emit after build
   - Test runner hook: emit after tests
   - Linter hook: emit after analysis
   - Runtime hook: emit metrics

3. **CodeBurn Provider**
   - Accept telemetry payloads
   - Aggregate + analyze
   - Return quality signals
   - Trigger feedback (regressions)

## Schemas

```typescript
interface CodeQualityMetrics {
  timestamp: ISO8601;
  tool: string;           // eslint, typescript, etc.
  metrics: {
    complexity: number;
    coverage: number;
    debt: number;
    lines: number;
  };
  artifacts?: string[];   // Report URLs
}

interface BuildMetrics {
  timestamp: ISO8601;
  build_id: string;
  status: 'success' | 'failure';
  duration_ms: number;
  artifacts: string[];
}
```

## Emitters

```typescript
class TelemetryEmitter {
  async emitCodeQuality(metrics: CodeQualityMetrics): Promise<void>
  async emitBuildMetrics(metrics: BuildMetrics): Promise<void>
  async emitPerformanceMetrics(metrics: PerfMetrics): Promise<void>
}

// Hooks for CI
emitter.onBuildComplete(build => emitBuildMetrics(...))
emitter.onTestComplete(tests => emitCodeQuality(...))
```

## CodeBurn Provider

```typescript
class CodeBurnProvider {
  async ingestTelemetry(metrics): Promise<void>
  async getQualitySignal(repo): Promise<QualitySignal>
  async detectRegressions(prev, curr): Promise<Regression[]>
}

type QualitySignal = 'healthy' | 'degraded' | 'critical'
```

## Feedback Loop

```
Build → Emit metrics → CodeBurn → Analyze → Emit signal
  ↓
CIC Memory → Detect drift → Governance → Council vote
  ↓
Block/approve changes based on quality
```

## Tests

- Schema validation ✓
- Emitter integration ✓
- CodeBurn provider ✓
- Regression detection ✓
- Feedback loop ✓
- E2E (build → signal → governance) ✓

## Files

```
src/telemetry/
  schemas.ts (150)
  emitters.ts (180)
  CodeBurnProvider.ts (140)
  
tests/
  Telemetry.test.ts
  CodeBurnProvider.test.ts
  Integration.test.ts
```

## Success Criteria ✅

✅ Telemetry schemas
✅ Emitters working
✅ CodeBurn provider
✅ Regression detection
✅ Feedback loop
✅ Tests >80%

## Ready for

- Phase 24 governance integration (quality signals → council decisions)
- Phase 25+ (use quality metrics for risk assessment)
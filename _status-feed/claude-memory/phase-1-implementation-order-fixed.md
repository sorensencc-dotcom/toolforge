---
name: phase-1-implementation-order-fixed
description: Phase 1 implementation order (12 steps) with explicit interface signatures for Steps 6-11
metadata:
  type: reference
  originSessionId: 7868a049-3774-41db-ade2-dd9374785bc7
---

# **PHASE 1 IMPLEMENTATION ORDER (FIXED — WITH SIGNATURES)**

12-step deterministic execution sequence. Each step includes method signatures.

---

## **STEP 1 — Create directory skeleton**

Create directories:
- `cic-os/src/core/ledger/`
- `cic-os/src/core/maal/`
- `cic-ingestion/src/orchestrator/`
- `postgres/ledgers/`

---

## **STEP 2 — Scaffold ledger event types**

Create: `LedgerEvent.ts`, `EventStream.ts`, `BackgroundWriter.ts`

**EventStream.ts signature:**
```typescript
export interface LedgerEvent {
  id: string;
  timestamp: number;
  eventType: string;
  data: unknown;
}

export interface EventStream {
  push(event: LedgerEvent): void;
  drain(batchSize: number): LedgerEvent[];
  size(): number;
}
```

**BackgroundWriter.ts signature:**
```typescript
export interface BackgroundWriter {
  start(): void;
  stop(): void;
  flush(): Promise<void>;
}
```

---

## **STEP 3 — Scaffold MAAL core interfaces**

Create: `TaskFingerprint.ts`, `RoutingRegimeSelector.ts`, `ConstraintEngine.ts`, `FallbackGraphValidator.ts`, `MAALRouter.ts`, `MAALRoutingOutput.ts`

**TaskFingerprint.ts:**
```typescript
export interface TaskFingerprint {
  taskClass: string;
  complexityBucket: 0 | 1 | 2 | 3 | 4 | 5;
  modality: "text" | "code" | "image+code";
  schemaSignature: string;
  tokenBucket: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

**RoutingRegimeSelector.ts:**
```typescript
export type RoutingRegime = "local_only" | "hybrid" | "remote_allowed";

export interface RoutingRegimeSelector {
  select(input: unknown): RoutingRegime;
}
```

**ConstraintEngine.ts:**
```typescript
export interface RoutingConstraints {
  maxCost: number;
  maxLatencyMs: number;
  allowedModels: string[];
  disallowedModels: string[];
}

export interface ConstraintEngine {
  derive(input: unknown): RoutingConstraints;
}
```

**FallbackGraphValidator.ts:**
```typescript
export interface FallbackEdge {
  from: string;
  to: string;
  onFailureCode: string;
}

export interface FallbackGraphValidator {
  validate(edges: FallbackEdge[]): boolean;
}
```

**MAALRouter.ts:**
```typescript
export interface MAALRoutingOutput {
  regime: RoutingRegime;
  constraints: RoutingConstraints;
  selectedModel?: string;
}

export interface MAALRouter {
  route(
    fingerprint: TaskFingerprint,
    input: unknown
  ): MAALRoutingOutput;
}
```

---

## **STEP 4 — Add Phase 1 integration interfaces to BridgeOrchestrator**

Modify: `cic-ingestion/src/orchestrator/BridgeOrchestrator.ts`

**Signature:**
```typescript
export interface MAARLRouterDependency {
  maalRouter: MAALRouter;
}
```

---

## **STEP 5 — Scaffold SQL ledger schemas**

Create: `routing_history.sql`, `drift_ledger.sql`, `model_performance_ledger.sql`, `cost_ledger.sql`

**Example (routing_history.sql):**
```sql
CREATE TABLE routing_history (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  task_fingerprint JSONB NOT NULL,
  routing_decision JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## **STEP 6 — Implement MAALRouter**

Implement:
```typescript
route(
  fingerprint: TaskFingerprint,
  input: unknown
): MAALRoutingOutput
```

Return placeholder output (no actual routing logic).

---

## **STEP 7 — Implement ConstraintEngine**

Implement:
```typescript
derive(input: unknown): RoutingConstraints
```

Return empty constraints (no logic).

---

## **STEP 8 — Implement RoutingRegimeSelector**

Implement:
```typescript
select(input: unknown): RoutingRegime
```

Return hardcoded regime (e.g., "local_only").

---

## **STEP 9 — Implement FallbackGraphValidator**

Implement:
```typescript
validate(edges: FallbackEdge[]): boolean
```

Return true (no validation logic).

---

## **STEP 10 — Implement TaskFingerprint**

Implement factory or method:
```typescript
compute(input: unknown): TaskFingerprint
```

Return hardcoded fingerprint.

---

## **STEP 11 — Implement EventStream + BackgroundWriter**

Implement:
- EventStream: ring buffer interface (no actual buffering)
- BackgroundWriter: timer interface (no actual writing)

---

## **STEP 12 — Freeze Phase 1**

Commit all 11 steps.

Tag: `v0.1.0-maal-foundation`

---

End Phase 1 Implementation Order (Fixed).

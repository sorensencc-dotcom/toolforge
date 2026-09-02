---
name: agent-drift-detector
description: Detect schema drift in agent messages and APIs. Compares expected vs. observed schema and alerts on field mismatches.
compatibility: |
  - Runtime: Node.js 18+
  - Dependencies: (see package.json)
---

# Agent Drift Detector

Detect schema drift in agent messages and APIs.

## Trigger

`/skill agent-drift-detector` — invoke from gstack or CLI

## Input Schema

```typescript
interface Input {
  expectedSchema: Record<string, unknown>;
  observedOutput: Record<string, unknown>;
  strict?: boolean;  // flag missing + unexpected fields (default: true)
}
```

## Output Schema

```typescript
interface Output {
  status: "success" | "error";
  passed: boolean;
  missingFields: string[];
  unexpectedFields: string[];
  timestamp: string;
}
```

---

**Full reference:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

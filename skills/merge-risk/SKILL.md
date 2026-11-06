---
name: merge-risk
description: "Evaluates pull request merge safety and scores risk across 5 weighted dimensions"
compatibility: |
  - Runtime: Node.js 18+
  - Dependencies: None (built-in node:fs, node:child_process)
  - Permissions: read:repo
---

# Merge Risk Specification

**ID**: `merge-risk`  
**Version**: 0.1.0  
**Status**: Active  
**Owner**: Toolforge Core

---

## Purpose

Deterministic scoring and audit of pull request merge safety across 5 weighted dimensions (Impact, Verification, Rollback, Error Detection, Alignment).

---

## Trigger

Exact prompt that invokes this skill:

```
Assess the merge risk for this pull request or branch.
```

---

## Input Schema

```typescript
interface MergeRiskInput {
  base?: string;
  head?: string;
  diffText?: string;
  cardData?: {
    id: string;
    target?: string;
    category?: string;
    tier?: string;
    intent?: string;
    files?: string[];
  };
  manualScores?: {
    alignment?: "poor" | "decent" | "good";
    impact?: "large" | "medium" | "small";
    verification?: "poor" | "decent" | "good";
    rollbackCost?: "high" | "medium" | "low";
    errorDetection?: "poor" | "decent" | "good" | "n/a";
  };
}
```

---

## Output Schema

```typescript
interface MergeRiskOutput {
  status: "success" | "error";
  risk: "low" | "medium" | "high";
  score: number;
  breakdown: {
    alignment: { verdict: "poor ⚠️" | "decent 👀" | "good ✅"; points: number; gaps: string[] };
    impact: { verdict: "large ⚠️" | "medium 👀" | "small ✅"; points: number; sensitivePaths: string[] };
    verification: { verdict: "poor ⚠️" | "decent 👀" | "good ✅"; points: number; gaps: string[] };
    rollbackCost: { verdict: "high ⚠️" | "medium 👀" | "low ✅"; points: number; rationale: string };
    errorDetection: { verdict: "poor ⚠️" | "decent 👀" | "good ✅" | "N/A ✅"; points: number; gaps: string[] };
  };
  formatted: string;
}
```

---

## Error Handling

See [Skill Operator Guide — Error Handling](../../docs/meta/skill-operator-guide.md#error-handling) for standard error codes.

| Code | Message | Handler |
| :--- | :--- | :--- |
| `INVALID_INPUT` | Input missing required diff or card payload | Reject execution with usage instruction |
| `GIT_DIFF_FAILED` | Unable to compute git diff between base and head | Check ref existence or provide diffText directly |

---

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**

For workflow examples and deep integration patterns:

**→ See [docs/USAGE.md](./docs/USAGE.md)**

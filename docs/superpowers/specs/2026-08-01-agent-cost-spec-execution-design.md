---
title: "CIC AI Agent Cost Governance Runtime Design Specification"
date: 2026-08-01
document_id: "CIC-COST-GOV-DESIGN-001"
status: CANDIDATE
parent_spec: "CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1"
---

# CIC AI Agent Cost Governance Runtime Design Specification

Document ID: `CIC-COST-GOV-DESIGN-001`  
Parent Spec: `CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1`  
Status: `CANDIDATE`  

## 1. Overview

This document specifies the design for `cost_governance_runtime.py` and `cost_gate_adapter.py` inside `CIC-GOVERNANCE`. The module provides fail-closed, thread-safe runtime enforcement of AI agent cost controls, task contracts, scope ceilings, atomic worst-case budget reservation, deterministic circuit breaker precedence, evidence logging, and report-only scaling gate evaluation.

## 2. Module Structure & Boundaries

- **`CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`**: Pure Python runtime engine.
- **`CIC-GOVERNANCE/adapters/cost_gate_adapter.py`**: Independent CLI/adapter interface for invocation and governance gate execution.
- **`CIC-GOVERNANCE/tests/test_cost_governance_runtime.py`**: Comprehensive test suite including failure-injection tests.

```
CIC-GOVERNANCE/
├── WRAPPERS/
│   └── cost_governance_runtime.py   # Core runtime engine
├── adapters/
│   └── cost_gate_adapter.py         # Standalone CLI/adapter interface
└── tests/
    └── test_cost_governance_runtime.py # Test suite & failure injection
```

## 3. Data-Driven Scope & Contract Validation

### 3.1 Pinned Parent Scope Limits
- `ScopeLimitsRegistry` enforces scope limits bound strictly to `CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1`.
- Any version mismatch or unmapped scope version triggers an immediate fail-closed error (`SCOPE_VERSION_MISMATCH`). Silent fallbacks are strictly prohibited.

```json
{
  "spec_version": "CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1",
  "scopes": {
    "S0": { "max_model_calls": 1, "max_tool_calls": 0, "max_input_tokens": 2000, "side_effects": "none" },
    "S1": { "max_model_calls": 3, "max_tool_calls": null, "max_input_tokens": 20000, "side_effects": "none" },
    "S2": { "max_model_calls": 8, "max_tool_calls": null, "max_input_tokens": 100000, "side_effects": "reversible" },
    "S3": { "max_model_calls": 12, "max_tool_calls": null, "max_input_tokens": 250000, "side_effects": "approval_required" },
    "S4": { "max_model_calls": null, "max_tool_calls": null, "max_input_tokens": null, "side_effects": "checkpointed" }
  }
}
```

### 3.2 Task Contract Validation
- Validates all 17 required contract parameters. Missing or ambiguous fields cause immediate fail-closed rejection (`CONTRACT_INVALID`).
- Validates caller-declared scope against the parent ceiling. Scope may be narrowed by runtime decision, but broadening is strictly denied.

## 4. Rate-Card Management & Atomic Reservation

### 4.1 Pinned Rate Cards & Estimation Race Protection
- Rate cards are versioned.
- At attempt admission, `admit_attempt()` captures and pins the active rate-card version for that attempt.
- `estimated_next_cost` reservation calculation **MUST** use the pinned rate-card version captured for that attempt, rather than re-fetching the active registry. This eliminates race conditions if rate cards update mid-attempt.

```text
attempt_cost =
    uncached_input_tokens * input_rate / 1,000,000
  + cached_input_tokens * cached_input_rate / 1,000,000
  + output_tokens * output_rate / 1,000,000
  + billed_reasoning_tokens * reasoning_rate / 1,000,000
  + tool_costs + infrastructure_costs
```

### 4.2 Thread-Safe Atomic Reservation & Rollback
- `AtomicBudgetGate` uses thread-safe mutex locks to manage active reservations indexed by `(task_id, attempt_id)`.
- Prevents double reservation by checking active attempt state.
- If `estimated_next_cost > remaining_budget`, call is blocked and returns `budget_exhausted`.
- Upon completion or failure, unused reservations are atomically released and actual provider usage is billed.

## 5. Deterministic Circuit Breaker Engine

Evaluates conditions in strict spec precedence order:

1. **Hard Limits**: Cost, calls, tokens, tools, or deadline exceeded (`budget_exhausted` / `limit_exceeded`).
2. **Safety / Authorization**: Permission or safety failure (`safety_violation` / `unauthorized`).
3. **Missing Approval**: Missing required approval (`needs_approval`).
4. **Duplicate / Unauthorized Side Effects**: Side effect policy violation (`unauthorized_side_effect`).
5. **Two Identical Failures**: Same failure class back-to-back (`repeated_failure`).
6. **Three Subtask Failures**: Subtask retries exhausted (`subtask_failure`).
7. **No Progress Limit**: Shared `no_progress_count` reaches 2 (`no_progress`).

Precedence ties are resolved deterministically by choosing the first matching condition in this exact order.

## 6. Append-Only Evidence Logger

- Emits schema-versioned (`1.0.0`) append-only JSONL traces with idempotent `event_id` keys (`EVT-<uuid>`).
- Flushes to disk with `os.fsync`.
- Contains both `model` (logical identity, e.g., `"gemini-3.6-flash"`) AND `model_snapshot` (pinned provider snapshot, e.g., `"gemini-3.6-flash-2026-06-01"`), plus all remaining required fields:
  `task_id`, `scope_declared`, `scope_used`, `baseline_id`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_tokens`, `tool_calls`, `retry_count`, `actual_cost_usd`, `baseline_cost_usd`, `net_savings_usd`, `success`, `quality_score`, `failure_class`, `escalated`, `escalation_count`, `termination_reason`, `elapsed_ms`, `provider`, `rate_card_version`, `currency`.

## 7. Scaling Gate (Report-Only Mode)

- Computes canary metrics (success rate, p95 cost, retry rate ≤ 15%, 0 duplicate side effects, 0 critical failures).
- Evaluates 50-task rolling window 25% cost regression.
- Operates strictly in `REPORT_ONLY` mode, returning structured advisory status. Automated enforcement requires Tier 1 ratification.

## 8. Verification & Failure-Injection Test Plan

The test suite in `tests/test_cost_governance_runtime.py` validates:
1. **Overspend Prevention**: Attempts exceeding `remaining_budget` fail closed.
2. **Duplicate Reservation & Rollback**: Concurrent or repeated reservation calls trigger isolation / safe rollback.
3. **Mid-Task Rate-Card Pinning**: Rate card changes during execution use pinned attempt version for both reservation and actual billing.
4. **Precedence Tie Resolution**: Multiple simultaneous triggers terminate with the highest-priority precedence reason.
5. **Partial Evidence Write Recovery**: File flush, integrity checks, and tail repair.

---
title: "TorqueQuery AI Agent Routing Policy"
date: 2026-08-01
status: CANDIDATE
decision: PROPOSED
critical_path: false
---

# TorqueQuery AI Agent Routing Policy

## Purpose

Define deterministic routing, retry, escalation, cost, and stop behavior for
TorqueQuery-backed agent work. This policy is adapter-side: it does not alter
TorqueQuery retrieval semantics, canonical service identity, or provider
contracts.

## Route contract

Every request MUST include:

```json
{
  "task_id": "string",
  "scope": "S0|S1|S2|S3|S4",
  "success_criteria": [],
  "allowed_tools": [],
  "max_input_tokens": 0,
  "max_output_tokens": 0,
  "max_cost_usd": 0,
  "max_model_calls": 1,
  "max_tool_calls": 0,
  "max_retries": 0,
  "max_wall_clock_seconds": 0,
  "escalation_policy": "none|stronger_model|human",
  "baseline_id": "string",
  "provider": "string",
  "model_snapshot": "string",
  "rate_card_version": "string",
  "deadline": "RFC-3339",
  "side_effect_policy": "read_only|reversible|approval_required"
}
```

Requests missing budget, scope, success criteria, or execution limits MUST be
rejected before model routing. Zero means no allowance; unset fields are
invalid. Exploratory runs MAY omit `baseline_id` only when explicitly marked.

## Routing algorithm

1. Validate contract and available budget.
2. Validate the caller-declared scope and narrow it when safely possible.
3. Select cheapest capable model.
4. Execute with hard token, call, tool, cost, and deadline limits.
5. Validate output against success criteria and schema.
6. Retry only according to failure class.
7. Escalate only when a stronger model has a plausible remedy and budget remains.
8. Return terminal status: `success`, `failed`, `needs_approval`, or `budget_exhausted`.

The router MUST NOT expand scope, tools, side-effect authority, or budget based
solely on model output. Caller-declared scope is authoritative; broader scope
requires a new task contract or approval.

## Default policy matrix

| Failure class | Action | Limit |
| --- | --- | ---: |
| Rate limit, timeout, 5xx | Backoff and retry | 2 |
| Schema failure | Constrained repair | 1 |
| Correctable tool arguments | Deterministic correction | 1 |
| Substantive answer failure | Critique/revise | 1 |
| Repeated identical failure | Terminal stop | 0 further |
| Permission, safety, authorization | Terminal stop | 0 |
| External write failure | Retry only if idempotent | 1 |

Retry state MUST record whether new information or changed context was added.
Two retries without new information MUST terminate the route. Repeated
identical failure MUST terminate the current route; escalation is permitted
only before this circuit breaker and only when all escalation conditions hold.

## Budget enforcement

The adapter MUST calculate actual cost from provider usage and maintain a
monotonic spend counter:

```text
remaining_budget = max_cost_usd - sum(all_attempt_costs)
```

Before every model or tool call, reserve the estimated worst-case permitted
cost:

```text
estimated_next_cost = reserved_input_cost + reserved_output_cost + expected_tool_cost
```

Before every model or tool call:

```text
if estimated_next_cost > remaining_budget:
    terminate budget_exhausted
```

Provider rate cards MUST be versioned. Cache-read tokens MUST be handled using
provider-specific billing rules and never double-counted. Unused reservations
MUST be released after actual usage is recorded. Provider adapters MUST
normalize reasoning-token fields.

## Fail-fast circuit breakers

Terminate route on:

- hard budget, call, token, tool, or deadline limit;
- two identical failures;
- three failed attempts on one subtask;
- two no-progress steps;
- duplicate or unauthorized side effect;
- missing required approval.

Missing approval MUST return `needs_approval`; an unauthorized action attempt
MUST return `failed`.

`no_progress` means no validated fact, passed check, completed subtask,
reduced uncertainty, or artifact improvement.

## TorqueQuery-specific behavior

- Retrieval failures MAY retry only when the failure is transient.
- Empty retrieval results MUST NOT trigger unlimited broadening. One bounded
  query reformulation is allowed; then return `needs_approval` or `failed`.
- Repeated retrieval results MUST be detected and counted as no progress.
- Retrieved context MUST be attributable in the trace by query, result IDs,
  ranking mode, and retrieval timestamp.
- Memory or document retrieval MUST remain read-only unless a separate,
  explicitly authorized write operation is declared.

## Savings measurement

Every production route MUST include `baseline_id` and record:

```text
baseline_cost_usd
actual_cost_usd
cache_savings_usd
routing_savings_usd
retry_cost_usd
human_review_cost_usd
rework_cost_usd
net_savings_usd
```

The authoritative outcome metric is:

```text
cost_per_successful_task = total_route_cost / successful_tasks
```

Savings are valid only when quality, safety, and latency remain within the
declared task tolerance.

## Trace contract

The adapter MUST emit:

```text
task_id, scope, request_hash, baseline_id, provider, model_snapshot,
rate_card_version, input_tokens, cached_input_tokens, output_tokens,
reasoning_tokens, tool_calls, retry_count, actual_cost_usd, baseline_cost_usd,
net_savings_usd, quality_score, success, failure_class, escalation,
termination_reason, elapsed_ms, retrieval_ids, ranking_mode,
retrieval_timestamp, currency
```

Side-effecting routes MUST also emit `idempotency_key` and
`side_effect_operation_id`.

Traces MUST be append-only and sufficient to reconstruct routing and spending.

## Scaling gate

No concurrency increase without a representative canary of at least 50
completed tasks, unless a statistically justified sample is approved.
Minimum gate:

```text
success_rate >= target
p95_cost_per_successful_task <= budget
retry_rate <= 15%
duplicate_side_effect_rate == 0
critical_failure_rate == 0
quality_score >= baseline_quality
```

`quality_score` and `baseline_quality` MUST use the same declared evaluator and
acceptance threshold.

Ramp traffic `1–5% -> 10% -> 25% -> 50% -> 100%`. Roll back at a 25% cost
regression, doubled failure rate, quality regression, or safety violation.

## Ownership and status

This document is a proposed adapter policy. It is not a TorqueQuery service
reconciliation decision and does not ratify the CIC governance specification.
Tier 1 approval is required before enforcing it as a cross-repository rule.

## Terminal response

Every route MUST return:

```json
{
  "status": "success|failed|needs_approval|budget_exhausted",
  "task_id": "string",
  "termination_reason": "string",
  "actual_cost_usd": 0,
  "retry_count": 0,
  "escalated": false
}
```

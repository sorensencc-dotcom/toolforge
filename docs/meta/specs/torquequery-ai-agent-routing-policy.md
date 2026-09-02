---
title: "TorqueQuery AI Agent Routing Policy"
date: 2026-08-01
status: CANDIDATE
decision: PROPOSED
critical_path: false
parent_spec: "CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1"
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
  "max_escalations": 0,
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

Scope ceilings, default call limits, token budgets, and side-effect rules MUST
be inherited from `CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1`, Section 3.
The pinned parent version MUST be updated through a reviewed policy revision
when the parent scope table changes. The router MUST validate each request
against both the caller-declared scope and the pinned parent ceiling.

## Routing algorithm

1. Validate contract and available budget.
2. Validate the caller-declared scope against the pinned parent ceiling; narrow
   it only when the narrower scope is explicit in the route decision.
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
Two retries without new information MUST increment the shared
`no_progress_count`. Repeated
identical failure MUST terminate the current route; escalation is permitted
only before this circuit breaker and only when all escalation conditions hold.

## Budget enforcement

The adapter MUST calculate actual cost from provider usage and maintain a
monotonic spend counter:

```text
remaining_budget = max_cost_usd - sum(all_attempt_costs)
```

Before every model or tool call, the adapter MUST perform one atomic budget
gate:

```text
estimated_next_cost = reserved_input_cost + reserved_output_cost + expected_tool_cost
if estimated_next_cost > remaining_budget:
    terminate budget_exhausted
else:
    reserve estimated_next_cost
```

Provider rate cards MUST be versioned. Cache-read tokens MUST be handled using
provider-specific billing rules and never double-counted. Unused reservations
MUST be released after actual usage is recorded. Provider adapters MUST
normalize reasoning-token fields.

## Fail-fast circuit breakers

Circuit-breaker precedence is deterministic. On any tick where multiple
conditions trigger simultaneously, the first matching condition in this order
controls the termination reason:

1. hard budget, call, token, tool, or deadline limit;
2. safety or authorization failure;
3. missing required approval;
4. duplicate or unauthorized side effect;
5. two identical failures;
6. three failed attempts on one subtask;
7. shared `no_progress_count` reaches 2.

This list extends `CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1` Section 6
precedence with two TorqueQuery-specific conditions (missing approval,
`no_progress_count`) inserted as shown; it does not reorder the parent's
shared conditions. Missing approval outranks duplicate/unauthorized side
effect because, under `approval_required`, no side effect can legally occur
before approval is granted — an unauthorized side effect at that point
signals the approval gate was already bypassed, so the approval failure is
the root cause and must be the reported reason.

Missing approval MUST return `needs_approval`; an unauthorized action attempt
MUST return `failed`.

`no_progress` means no validated fact, passed check, completed subtask,
reduced uncertainty, or artifact improvement. A retry without new information
and a no-progress step increment the same `no_progress_count`; they are not
separate allowances. The counter resets only after observable progress.

## TorqueQuery-specific behavior

- Retrieval failures MAY retry only when the failure is transient.
- Empty retrieval results MUST NOT trigger unlimited broadening. One bounded
  query reformulation is allowed; then return `needs_approval` or `failed`.
  A bounded reformulation MUST use no more than 2x the original query
  characters, add no more than 256 characters, preserve declared scope and
  allowed tools, and consume no more than one retrieval escalation.
- Repeated retrieval results MUST be detected and counted as no progress. A
  result is repeated when its ordered result-ID list is identical to the prior
  result, or when top-k result-ID set Jaccard similarity is at least 0.90.
  Reordering or ranking-mode changes do not reset `no_progress_count` unless
  they produce a materially different result set under that rule.
- Retrieved context MUST be attributable in the trace by query, result IDs,
  ranking mode, and retrieval timestamp.
- Memory or document retrieval MUST remain read-only unless a separate,
  explicitly authorized write operation is declared.
- Retrieval escalation is distinct from model escalation but consumes the
  shared `max_escalations` budget. It MAY use one bounded reformulation or one
  stronger declared ranking mode, never both without a new route decision. A
  transient retrieval failure MAY retry under the retry matrix; an empty or
  repeated result after permitted retrieval escalation MUST return
  `needs_approval` or `failed`.

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
task_id, scope_declared, scope_used, request_hash, baseline_id, provider, model_snapshot,
rate_card_version, input_tokens, cached_input_tokens, output_tokens,
reasoning_tokens, tool_calls, retry_count, actual_cost_usd, baseline_cost_usd,
net_savings_usd, quality_score, success, failure_class, escalation,
escalation_count, termination_reason, elapsed_ms, retrieval_ids, ranking_mode,
retrieval_timestamp, currency
```

Side-effecting routes MUST also emit `idempotency_key` and
`side_effect_operation_id`.

Traces MUST be append-only and sufficient to reconstruct routing and spending.

## Scaling gate

No concurrency increase without a representative canary of at least 50
completed tasks. A smaller or different sample requires Tier 1 approval before
the canary begins, a predeclared statistical method, and an evidence record
showing method, confidence level, sample size, and acceptance thresholds.
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

Ramp traffic `1–5% -> 10% -> 25% -> 50% -> 100%`. Rollback follows
`CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1` Section 7: a rolling window of
at least 50 completed tasks must show a 25% cost-per-successful-task
regression, doubled failure rate, or material quality regression before
cost-based rollback triggers; a single task MUST NOT trigger cost-based
rollback. Any critical safety violation triggers immediate rollback
regardless of sample size.

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
  "failure_class": "string|null",
  "actual_cost_usd": 0,
  "retry_count": 0,
  "escalated": false
}
```

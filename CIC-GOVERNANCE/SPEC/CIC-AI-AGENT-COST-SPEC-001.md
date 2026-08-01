---
title: "CIC AI Agent Cost Control Specification"
document_id: "CIC-AI-AGENT-COST-SPEC-001"
category: "spec"
status: "candidate"
version: "1.0.0-candidate.1"
---

# CIC AI Agent Cost Control Specification

Document ID: `CIC-AI-AGENT-COST-SPEC-001`  
Version: `1.0.0-candidate.1`  
Status: `CANDIDATE — NOT RATIFIED`  
Authority: Tier 1 approval required for ratification  
Automation role: Tier 3 enforcement only

## 1. Purpose

Bound agent autonomy, make spend predictable, and provide auditable evidence
for every model call, retry, escalation, tool call, termination, and saving.

This specification governs runtime enforcement. It does not authorize a task,
external side effect, model-provider account, or budget increase.

## 2. Task contract

Every agent task MUST declare:

```yaml
task_id: string
scope: S0 | S1 | S2 | S3 | S4
success_criteria: []
allowed_tools: []
side_effect_policy: read_only | reversible | approval_required
max_model_calls: integer
max_tool_calls: integer
max_input_tokens: integer
max_output_tokens: integer
max_cost_usd: number
max_wall_clock_seconds: integer
max_retries: integer
escalation_policy: none | stronger_model | human
baseline_id: string
provider: string
model_snapshot: string
rate_card_version: string
```

Undeclared tools, side effects, model escalation, or budget expansion MUST be
denied or routed to the designated approval state. Caller-declared scope is
authoritative; runtime MAY narrow scope but MUST NOT broaden it.

## 3. Scope defaults

| Scope | Work | Calls | Token budget | Side effects |
| --- | --- | ---: | ---: | --- |
| S0 | Classification, extraction, formatting | 1 | 2k | None |
| S1 | Summary, transformation, simple lookup | 3 | 20k | None |
| S2 | Research, coding, document analysis | 8 | 100k | Reversible only |
| S3 | Production, legal, financial, external writes | 12 | 250k | Approval required |
| S4 | Long-running autonomy | Explicit | Explicit | Checkpointed |

Defaults are calibration starting points. Runtime MAY use stricter limits. A
looser limit requires an approved amendment and evidence from representative
task traces.

## 4. Cost accounting

Runtime MUST calculate each attempt from provider-reported usage:

```text
attempt_cost =
  uncached_input_tokens * input_rate / 1,000,000
+ cached_input_tokens * cached_input_rate / 1,000,000
+ output_tokens * output_rate / 1,000,000
+ billed_reasoning_tokens * reasoning_rate / 1,000,000
+ tool_costs
+ infrastructure_costs
```

`run_cost` MUST equal the sum of all attempt and tool costs. Cached tokens MUST
NOT be counted twice. Provider-specific billing adapters MUST document whether
reasoning tokens are included in input, output, or a separate billable field.

The runtime MUST enforce:

```text
remaining_budget = max_cost_usd - run_cost
```

Before each model or tool call, runtime MUST reserve the estimated worst-case
permitted cost:

```text
estimated_next_cost = reserved_input_cost + reserved_output_cost + expected_tool_cost
```

Unused reservation MUST be released after actual provider usage is recorded.

## 5. Routing and escalation

The default route is cheapest capable model, followed by explicit validation.
Retry is permitted only for a recoverable failure. Escalation requires:

1. substantive failure;
2. plausible remedy from the stronger model;
3. sufficient remaining budget; and
4. no increase in task scope or side-effect authority.

Formatting-only errors SHOULD be repaired deterministically. Safety,
authorization, and permission failures MUST stop immediately.

## 6. Retry and fail-fast controls

| Failure | Maximum action |
| --- | --- |
| 429, timeout, 5xx | Two retries with capped backoff and jitter |
| Invalid schema | One constrained repair |
| Deterministic tool error | One corrected retry |
| Wrong substantive result | One critique/revise attempt |
| Same failure twice | Stop or escalate |
| External side effect | Retry only with idempotency protection |
| Safety/auth failure | Immediate stop |

Execution MUST stop on any hard limit: cost, calls, tokens, tools, deadline,
duplicate side effect, or unauthorized action.

Execution MUST also stop after two identical failures, three failed attempts
on one subtask, or two retries without new information. Escalation is permitted
only before the repeated-failure circuit breaker and only when all escalation
conditions are satisfied.

Progress means a validated fact, passed acceptance test, completed subtask,
reduced uncertainty, or artifact change toward success criteria. Additional
generated text is not progress.

## 7. Scaling gate

Concurrency MAY increase only after a representative canary demonstrates:

```text
success_rate >= target
cost_per_successful_task <= budget
p95_cost_per_successful_task <= budget
retry_rate <= target
duplicate_side_effect_rate == 0
critical_failure_rate == 0
quality_score >= baseline_quality
```

Recommended ramp: `1–5% -> 10% -> 25% -> 50% -> 100%`.

Automatic rollback MUST occur for a 25% increase in cost per successful task,
doubled failure rate, material quality regression, or any critical safety
violation.

## 8. Savings and baselines

Savings MUST reference a declared `baseline_id`:

```text
gross_savings = baseline_cost - actual_cost
net_savings = gross_savings - added_infrastructure_cost - human_review_cost - rework_cost
```

Savings MUST be labeled `estimated`, `validated`, or `realized`. Cost reduction
does not qualify as savings if quality, safety, or SLA falls outside tolerance.

## 9. Required evidence

Each task MUST emit:

```text
task_id, scope, baseline_id, model, input_tokens, cached_input_tokens,
output_tokens, reasoning_tokens, tool_calls, retry_count, actual_cost_usd,
baseline_cost_usd, net_savings_usd, success, quality_score, failure_class,
escalated, termination_reason, elapsed_ms, provider, model_snapshot,
rate_card_version, currency
```

TorqueQuery adapters MUST also emit `request_hash`, `retrieval_ids`,
`ranking_mode`, and `retrieval_timestamp`. Side-effecting adapters MUST emit
`idempotency_key` and `side_effect_operation_id`.

Primary metric:

```text
cost_per_successful_task = total_cost / successful_tasks
```

Test success demonstrates implementation readiness only. Ratification requires
Tier 1 approval, an amendment or manifest linkage, and durable evidence.

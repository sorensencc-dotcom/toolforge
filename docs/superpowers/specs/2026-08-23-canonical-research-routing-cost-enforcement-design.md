# Canonical Research Routing and Cost Enforcement Design

Status: DRAFT FOR REVIEW  
Date: 2026-08-23  
Scope: Sigil, TorqueQuery, CIC-ingestion, Toolforge, provider hosts, and operational/commercial cost accounting

## 1. Purpose

Define one enforceable routing and accounting contract for research work. The system must select the cheapest capable route subject to quality, scope, deadline, budget, authorization, and hardware constraints. Phase 1 is report-only; later phases activate shadow and hard gates without changing the event model.

This design does not ratify the existing candidate cost specification, authorize external provider accounts, or claim that Claude, Codex, or Antigravity runtime adapters currently exist.

## 2. Existing capabilities and gaps

| Area | Existing evidence | Required treatment |
|---|---|---|
| Sigil | Signed envelopes, endpoint identity, capability grants, approvals, durable relay, idempotency, audit records | Use as authorization, provenance, approval, and delivery boundary |
| TorqueQuery | Proposed routing policy, bounded retrieval escalation, trace fields | Promote compatible fields into canonical route events; preserve retrieval ownership |
| CIC-ingestion/chat-agent | Quality signals and cost-tier selector | Reuse signals; replace label-only selection with capability-backed dispatch |
| Toolforge | Real Ollama provider and direct provider API | Route through canonical admission and provider registry |
| External hosts | Host/connector boundaries and protocol work exist; runtime claims vary | Register only verified adapters and receipts |
| Cost runtime | Candidate contract and governance runtime design | Treat as candidate until conformance and authority gates complete |

The central gap is enforcement wiring: the current Toolforge path can call Ollama directly, while model catalog entries do not prove provider execution.

## 3. Canonical task contract

The signed task request carries immutable governance metadata. Relay and workers may narrow, but never broaden, these values.

```yaml
schema_version: research.task.v1
task_id: string
scope: S0 | S1 | S2 | S3 | S4
quality_tier: basic | verified | deep | critical
min_quality_score: number
success_criteria: []
allowed_tools: []
allowed_providers: []
side_effect_policy: read_only | reversible | approval_required
deadline: RFC-3339
max_model_calls: integer
max_tool_calls: integer
max_input_tokens: integer
max_output_tokens: integer
max_cost_usd: number
max_retries: integer
max_escalations: integer
escalation_policy: none | stronger_model | human
budget_scope: task | project | customer | weekly
baseline_id: string
rate_card_version: string
model_snapshot_policy: pinned | approved_range
reporting_identity: project/customer reference or privacy-preserving subject
```

Missing governance fields are rejected for protected or commercial routes. Explicitly marked legacy routes may run report-only with `legacy_contract`; they must not be silently treated as basic-quality work or receive side-effect authority.

## 4. Capability and provider registry

Every provider/model entry must declare:

- provider identity and adapter version;
- model identity and immutable snapshot or approved range;
- supported task types, quality evaluators, context/token limits, and tools;
- latency and concurrency envelope;
- hardware requirements, including VRAM where local;
- input/output/cached/reasoning rates or an explicit cost classification;
- receipt format and health status;
- expiry and evidence references.

Quality scores are evaluator-specific, versioned, and never inferred from a generic benchmark alone. A local provider is not cost-free: its cost basis is `allocated` and may include compute, GPU/CPU time, storage, and shared service allocation. A subscription provider may be `notional` unless billable usage is available.

## 5. Routing and enforcement

The router performs these steps in order:

1. Validate signature, schema, scope, approval state, and budgets.
2. Resolve task capability requirements from quality tier and success criteria.
3. Filter providers by authorization, capability, health, deadline, hardware, and quality floor.
4. Estimate worst-case cost and reserve budget atomically.
5. Select the lowest-cost eligible route; use deterministic tie-breakers for quality margin, latency, and provider priority.
6. Execute through the provider adapter, never by direct caller bypass.
7. Validate output, quality, schema, usage receipt, and side-effect policy.
8. Retry or escalate only within the signed limits.
9. Emit terminal status and append the route/cost evidence.

Hard rules:

- No provider call without a validated contract, capability match, route decision, provider identity, model snapshot, and budget admission.
- Work below the quality floor is rejected, not silently sent to a cheaper local model.
- Ollama receives work only when its declared capability, hardware, latency, and quality envelope match the task.
- A timeout or provider failure may escalate only when the contract permits it, budget remains, and the stronger provider has a declared plausible remedy.
- Safety, authorization, approval, duplicate-side-effect, and hard-budget failures fail closed.

## 6. Sigil boundary

Sigil owns endpoint identity, signed task provenance, capability grants, approval state, durable delivery, idempotency, and append-only relay/audit events. It does not independently determine research quality or invent provider capabilities.

External escalation must preserve the original `task_id`, budget, scope, quality floor, escalation count, and route lineage. An approval must bind to the task/action hash and authorize only the declared capability and delta. Existing WebAuthn evidence must be described as relay-verification/conformance proof until a deployed browser UX is independently verified.

## 7. Cost event and weekly reporting

Each attempt emits a normalized append-only event:

```yaml
event_id: string
schema_version: cost.event.v1
task_id: string
run_id: string
attempt_id: string
parent_attempt_id: string|null
budget_scope: task | project | customer | weekly
reporting_identity: string
provider: string
model: string
model_snapshot: string
rate_card_version: string
cost_classification: actual | estimated | notional | allocated
currency: string
uncached_input_tokens: integer
cached_input_tokens: integer
output_tokens: integer
reasoning_tokens: integer
tool_cost_usd: number
infrastructure_cost_usd: number
actual_cost_usd: number
baseline_cost_usd: number|null
quality_score: number|null
quality_evaluator: string|null
success: boolean
failure_class: string|null
retry_count: integer
escalated: boolean
escalation_count: integer
termination_reason: string
elapsed_ms: integer
retrieval_ids: []
ranking_mode: string|null
retrieval_timestamp: string|null
approval_id: string|null
idempotency_key: string|null
created_at: string
```

`actual_cost_usd` is billable only when supported by provider usage evidence. Estimated, notional, and allocated values remain visible but cannot be presented as invoices. Escalations and retries add to total cost; they are not subtracted from savings.

Weekly reports operate first as dashboards and decision evidence:

- total cost by classification, provider, model, project, and customer;
- cost per successful task and quality-adjusted cost;
- quality-floor failures and rejected-local-work count;
- retry, escalation, timeout, and budget-warning rates;
- estimated versus actual variance;
- baseline, gross savings, net savings, and confidence labels;
- route mix, latency, and margin indicators for future commercialization.

## 8. Gate phases

### Phase 1: operational

Record events and generate weekly reports. No aggregate spending block.

### Phase 2: shadow

Evaluate task, project, customer, and weekly budgets; record simulated blocks, quality violations, and false-positive outcomes without stopping execution.

### Phase 3: enforcement

Block over-budget or below-quality routes, or return `needs_approval` when the contract permits human escalation. Emergency overrides require explicit Sigil approval and audit evidence.

### Phase 4: commercial

Expose customer quality tiers, spend limits, estimates, route transparency, margin controls, and quality/cost tradeoff decisions. Customer budget must never lower a declared quality floor silently.

## 9. Conformance and negative tests

Required tests exercise real default wiring where applicable:

- invalid or unsigned governance contract: zero provider calls;
- below-quality local candidate: rejected, no Ollama call;
- insufficient budget for all capable routes: `budget_exhausted`;
- expired or missing rate card: fail closed;
- Ollama timeout/unhealthy/VRAM mismatch: bounded escalation or terminal stop;
- external provider unavailable: no unauthorized fallback;
- approval required without valid Sigil decision: `needs_approval`;
- valid approval cannot broaden scope or side effects;
- duplicate delivery and retry remain idempotent;
- retries and escalations retain one task lineage and add cost;
- subscription/notional and local/allocated costs are not mislabeled actual;
- weekly aggregation reconciles event totals and excludes partial events;
- quality score below floor blocks even when cheaper;
- report-only mode warns but does not block;
- shadow and hard modes produce equivalent decision reasons.

## 10. Stale-contract cleanup

Build a registry mapping every related document and runtime artifact to `live`, `partial`, `candidate`, `historical`, `superseded`, or `contradictory`. Each entry records its authority, owner, version, implementation evidence, and replacement. Superseded documents move to the governed archive with a pointer; history is not deleted.

The cleanup must specifically reconcile:

- candidate cost spec versus implemented governance runtime;
- TorqueQuery routing policy versus actual adapters;
- CIC-ingestion quality signals versus provider dispatch;
- Toolforge direct Ollama routes versus canonical admission;
- Sigil task/approval schemas versus host connectors;
- historical staging/GPU claims versus dated receipts;
- model catalog IDs, prices, benchmark claims, and expiry.

## 11. Acceptance boundary

This design is ready for implementation planning only after:

- every live path has an owner and adapter boundary;
- canonical event fields and cost classifications are approved;
- quality evaluators and provider evidence sources are named;
- report-only behavior is demonstrated without blocking;
- negative tests prove no direct-provider bypass;
- stale documents are mapped, not silently edited;
- Tier 1 ratifies any governance or cross-repository rule changes.


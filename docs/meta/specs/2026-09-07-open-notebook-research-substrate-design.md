Exit code: 0
Wall time: 0.4 seconds
Output:
# Open Notebook research substrate design

**Status:** DESIGN — blocked on contract lock
**Owner:** TRM  
**Version:** 0.1  

## Provenance & Attribution

> [!NOTE]
> TRM integrates the external project **[Open Notebook](https://github.com/lfnovo/open-notebook)**, created by **lfnovo**. Source: [https://github.com/lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) (License: MIT).
>
> TRM wraps the external Open Notebook API through a native `open-notebook-local` adapter, policy guard, health probe, and receipt builder. Open Notebook remains unmodified behind Toolforge process controls; TRM's governance, lineage, and receipt components are first-party/native.

## Purpose

Define an isolated, local-only, non-canonical Open Notebook research adapter
for TRM. V1 does not alter existing NotebookLM callers or select between
substrates. Open Notebook adds no authority for lineage, governance,
specifications, or canonical knowledge stores.

## Upstream boundary note

Open Notebook must not run in parallel with TRM or NotebookLM workflows until
the surrounding model-routing and authority boundaries are explicitly defined.
The boundary decision must establish Toolforge ownership of runtime and
provider policy, local-model defaults, explicit cloud escalation, TRM receipt
requirements, NotebookLM's grounded-review role, and CIC's canonical authority.
Until those decisions are recorded and tested, Open Notebook remains an
isolated research substrate and is not part of the active production research
loop.

## Scope and boundary

V1 covers the isolated adapter contract, local policy enforcement, response
normalization, and immutable research receipts. It does not add substrate
selection to the production research loop. Toolforge owns Open Notebook's
managed process group and runtime ceilings in a later coordinated slice.
Open Notebook's frontend, LangGraph workflows, Esperanto provider layer, and
SurrealDB remain behind the runtime boundary. TRM does not access SurrealDB
directly.

The adapter accepts only a loopback Open Notebook API endpoint. Cloud-provider
use is an explicit provider-policy choice, not an implicit fallback. Open
Notebook can read exported research inputs, but it cannot write TRM, KB-Sync,
CIC, or other canonical stores.

## Components

The V1 seam is the existing closed-loop research script path in
`scripts/run-closed-loop-research-v2.mjs` and its NotebookLM CLI/upload calls.
V1 characterizes that path; it does not claim a shared adapter already exists.
Substrate selection is V2 and requires a signed authority decision.

`OpenNotebookLocalAdapter` validates the request, checks local API health,
invokes the API, enforces timeout and output-size limits, and normalizes the
response. It must not expose provider-specific response shapes to callers.

`SubstratePolicy` validates loopback addressing, workspace identity, provider
opt-in, allowed workflow intent, and forbidden canonical-write intent before
process or network access.

`ResearchReceiptBuilder` canonicalizes request and response metadata, computes
SHA-256 input and output hashes, and emits the immutable TRM receipt.

`OpenNotebookHealthProbe` verifies loopback HTTP API readiness only. Process
availability and process-group supervision are outside V1 and remain owned by
Toolforge.

## Data flow

1. TRM validates a research request and assigns a correlation ID.
2. Policy validation rejects invalid workspace, endpoint, provider, or intent.
3. The adapter confirms local health and sends deterministic policy fields.
4. Open Notebook performs source processing, workflow execution, and model work.
5. The adapter validates response shape and source references.
6. TRM canonicalizes payloads, computes hashes, and builds the receipt bundle.
7. The receipt enters non-canonical research review; no canonical write occurs.

The receipt includes model identity, provider, input hash, output hash, operator
ID, timestamp, workflow ID, correlation ID, source references, policy version,
adapter version, outcome, and normalized draft output.

## Failure and replay contract

The adapter fails closed on malformed requests or responses, non-loopback
endpoints, missing workspace or source identity, provider-policy violations,
timeouts, output ceilings, health failures, missing model/provider/workflow
metadata, hash failures, or receipt-write failures.

The adapter never silently retries an invocation that may have completed. An
`indeterminate` result requires recorded operator resolution before any replay;
replay is permitted only after the pinned API contract proves idempotency.
Receipts use exactly one of `accepted`, `rejected`, `timed_out`, or
`indeterminate`. An `indeterminate` receipt cannot enter canonical review.

## Testing and evidence

Focused tests cover valid normalization, endpoint and intent rejection,
metadata validation, timeout and size limits, deterministic serialization and
hashes, receipt immutability, idempotency, indeterminate outcomes, and
characterization tests cover the current closed-loop script seam. Pinned local
API fixtures cover Open Notebook normalization, replay, and idempotency. No
shared-interface compatibility claim is made in V1.

Evidence remains separate by layer: local unit and adapter tests, a labeled
live local Open Notebook smoke test, and production/deployment evidence. A
passing mocked test does not establish live substrate availability or
production readiness.

## Explicit non-goals

- Direct SurrealDB integration.
- Remote/shared Open Notebook service access.
- Automatic cloud-provider fallback.
- Sigil UI changes.
- Toolforge process-manager implementation and process availability checks.
- KB-Sync writes or canonical CIC/TRM mutations.
- Governance decisions made by Open Notebook workflows.

## Contract lock required before implementation

The following must be recorded here before adapter implementation begins:

- Open Notebook upstream git SHA and license verification.
- Exact loopback HTTP health, invoke, and replay methods and paths.
- Typed TRM request and normalized result schemas, including closed enums for
  allowed workflow intents and forbidden canonical-write intents.
- Receipt schema, canonical JSON byte ordering, storage path, hash inputs,
  failure-atomic temp-file/rename protocol, and review handoff state.
- Provider-policy document and configuration name. V1 must use the existing
  WhichLLM selection record from `_integration/model_selection.json` and reject
  any response whose provider/model echo does not match the explicit opt-in.
- Operator-resolution record required for every indeterminate invocation.

TRM owns the contract, seam, policy, receipts, and adapter tests. Toolforge
owns process-level CPU, memory, concurrency, timeout, and orphan-cleanup
enforcement, plus the cross-repository integration test in its own slice.

Receipt persistence must be failure-atomic, and pinned Open Notebook response
fixtures must cover normalization, replay, and idempotency. Toolforge runtime
limits and TRM request-level limits must be tested separately. Checkout hygiene
belongs in the implementation plan, not this substrate contract.

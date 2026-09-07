Exit code: 0
Wall time: 0.4 seconds
Output:
# Open Notebook research substrate design

**Status:** Design approved in chat; written-spec review pending  
**Owner:** TRM  
**Version:** 0.1  

## Provenance & Attribution

> [!NOTE]
> TRM integrates the external project **[Open Notebook](https://github.com/lfnovo/open-notebook)**, created by **lfnovo**. Source: [https://github.com/lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) (License: MIT).
>
> TRM wraps the external Open Notebook API through a native `open-notebook-local` adapter, policy guard, health probe, and receipt builder. Open Notebook remains unmodified behind Toolforge process controls; TRM's governance, lineage, and receipt components are first-party/native.

## Purpose

Place Open Notebook behind TRM's existing NotebookLM research boundary as a
local-only, non-canonical research substrate. Existing NotebookLM callers keep
working through substrate selection. Open Notebook adds local ingestion,
workflow, and model-provider capability without becoming an authority for
lineage, governance, specifications, or canonical knowledge stores.

## Scope and boundary

V1 covers the TRM-facing adapter contract, local policy enforcement, response
normalization, and immutable research receipts. Toolforge owns Open Notebook's
managed process group and runtime ceilings. Open Notebook's frontend, API,
LangGraph workflows, Esperanto provider layer, and SurrealDB remain behind that
runtime boundary. TRM does not access SurrealDB directly.

The adapter accepts only a loopback Open Notebook API endpoint. Cloud-provider
use is an explicit provider-policy choice, not an implicit fallback. Open
Notebook can read exported research inputs, but it cannot write TRM, KB-Sync,
CIC, or other canonical stores.

## Components

`ResearchSubstrate` defines the stable TRM-facing interface shared by the
existing NotebookLM implementation and `open-notebook-local`.

`OpenNotebookLocalAdapter` validates the request, checks local API health,
invokes the API, enforces timeout and output-size limits, and normalizes the
response. It must not expose provider-specific response shapes to callers.

`SubstratePolicy` validates loopback addressing, workspace identity, provider
opt-in, allowed workflow intent, and forbidden canonical-write intent before
process or network access.

`ResearchReceiptBuilder` canonicalizes request and response metadata, computes
SHA-256 input and output hashes, and emits the immutable TRM receipt.

`OpenNotebookHealthProbe` verifies API readiness and process availability. It
does not query or mutate SurrealDB.

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

The adapter does not automatically retry an invocation that may have completed
unless the correlation ID provides idempotent replay. Receipts use exactly one
of `accepted`, `rejected`, `timed_out`, or `indeterminate`. An `indeterminate`
receipt cannot enter canonical review without explicit operator resolution.

## Testing and evidence

Focused tests cover valid normalization, endpoint and intent rejection,
metadata validation, timeout and size limits, deterministic serialization and
hashes, receipt immutability, idempotency, indeterminate outcomes, and
NotebookLM compatibility. Mocked local-API integration tests cover the wired
adapter path.

Evidence remains separate by layer: local unit and adapter tests, a labeled
live local Open Notebook smoke test, and production/deployment evidence. A
passing mocked test does not establish live substrate availability or
production readiness.

## Explicit non-goals

- Direct SurrealDB integration.
- Remote/shared Open Notebook service access.
- Automatic cloud-provider fallback.
- Sigil UI changes.
- Toolforge process-manager implementation.
- KB-Sync writes or canonical CIC/TRM mutations.
- Governance decisions made by Open Notebook workflows.

## Open implementation decisions

The implementation plan must select the existing TRM request/result types,
local API endpoint contract, receipt storage location, and provider-policy
configuration names by inspecting current code. It must preserve unrelated
dirty work and use a writable sandbox checkout for implementation and tests.



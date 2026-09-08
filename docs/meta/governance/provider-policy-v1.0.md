---
status: APPROVED
version: 1.0
classification: governance
approved_by: Chris Sorensen
approved_at: 2026-09-08
credential_steward: Chris Sorensen
---

# Provider policy v1.0

Candidate policy for hybrid language-model use across Toolforge, TRM, KB-Sync,
CIC, Sigil, and Rewrite Labs. This document is non-authoritative until Tier 1
ratification.

## Ownership

- Toolforge owns runtime ceilings, process lifecycle, and provider reachability.
- TRM owns research intent, policy validation, lineage, and receipts.
- WhichLLM owns the selected provider/model decision record.
- Chris Sorensen owns credential stewardship, rotation, and policy-package
  submission.

## Provider and model policy

- Local default: `ollama` with an explicitly selected model from the validated
  WhichLLM record.
- Current test candidate: `qwen2.5:7b`; AMD Radeon 780M evidence shows CPU
  execution, not GPU acceleration.
- Cloud providers require explicit Tier 1 approval and per-request opt-in.
- Unknown providers and models are rejected before execution.

## Routing states

`local`, `cloud-approved`, and `rejected` are the only routing states.

- `local` passes only when model, envelope, policy, and runtime checks pass.
- `cloud-approved` additionally requires Tier 1 approval and credential-steward
  authorization.
- `rejected` hard-fails, logs, emits a TRM event, and generates a receipt.

## Echo mismatch

The request records `requested_provider` and `requested_model`. The response
records `echo_provider` and `echo_model`. Any inequality sets
`echo_mismatch: true`, selects `rejected`, and records one of
`PROVIDER_MISMATCH`, `MODEL_MISMATCH`, or `BOTH_MISMATCH`. No retry or fallback
is permitted.

## Evidence boundary

Every invocation requires Toolforge envelope metadata, operator identity,
provider/model identity, input hash, output hash, routing state, and a receipt
conforming to `schemas/provider-receipt-v1.schema.json`. Provider routing and
production use remain prohibited until Tier 1 ratification.

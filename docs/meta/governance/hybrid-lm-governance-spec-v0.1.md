---
status: APPROVED
version: 0.1
classification: governance
approved_by: Chris Sorensen
approved_at: 2026-09-08
---

# Hybrid LM governance spec v0.1

This candidate governs local and cloud language-model use across CIC and
Rewrite Labs. It remains non-authoritative until Tier 1 ratification.

## Canonical boundaries

Toolforge supervises every model process and emits structured runtime events.
TRM and CIC define allowed intent, lineage, receipts, and canonical-write
boundaries. KB-Sync remains the canonical knowledge backbone. LMs may propose
non-canonical research, drafts, summaries, and hypotheses; they may not write
canonical stores, decide gates, or establish lineage authority.

## Routing

Requests use only `local`, `cloud-approved`, or `rejected`. Local routing is
allowed only after model, envelope, policy, and runtime checks pass. Cloud
routing requires Tier 1 approval, explicit operator opt-in, and credential
steward authorization. Rejected requests fail closed without retry or fallback.

## Cross-references

- Provider rules: `provider-policy-v1.0.md`
- Selection evidence: `_integration/model_selection.json`
- Receipt schema: `schemas/provider-receipt-v1.schema.json`

## Approval boundary

Provider routing, cloud escalation, canonical integration, and production use
remain prohibited until Tier 1 ratifies this document and its cross-referenced
artifacts.

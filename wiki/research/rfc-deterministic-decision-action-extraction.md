---
title: "RFC: Deterministic Decision & Action Extraction from Ingress Payloads"
category: "research"
topic: "rfc-deterministic-decision-action-extraction"
gap_id: "act-02-deterministic-decision-action-extraction"
status: "draft"
created_at: "2026-09-28T14:26:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "claude-3-5-sonnet-20241022"
router_confidence: 0.50
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: "https://github.com/sorensencc-dotcom/toolforge/issues/61"
citations:
  - "scripts/trm-ingress-watcher.mjs"
  - "scripts/whichllm-router.mjs"
  - "scripts/dom-action-selector.mjs"
---

# RFC: Deterministic Decision & Action Extraction from Ingress Payloads

## 1. Problem statement & objectives
Mobile capture tools (Google Docs `.gdoc` shortcuts, voice memos, quick notes) deliver unstructured natural language requests that require transformation into typed, machine-executable action items.

Heuristic, free-form LLM parsers frequently suffer from:
1. **Schema drift & hallucinated fields**: Outputting arbitrary keys or unvalidated priorities.
2. **Duplication on re-scan**: Lack of deterministic cryptographic deduplication leading to duplicate GitHub issues or task spawns.
3. **Uncalibrated routing**: Misclassifying low-complexity deterministic fixes as expensive Tier 1 reasoning tasks.

---

## 2. Ingress & extraction pipeline architecture

### 2.1 Two-phase extraction pipeline
1. **Phase 1: Deterministic header parsing**:
   - Extract timestamps, origin signatures, and canonical slugs directly from the file naming convention (`YYYY-MM-DDTHHMMSSZ__action__<intent>.md.gdoc`).
   - Generate a SHA-256 fingerprint over the sanitized payload body.
2. **Phase 2: Typed Jev extraction**:
   - Apply constrained logit decoding or schema-enforced JSON emission for typed intent classification (`antigravity_triage` vs `deterministic_fix`).
   - Extract discrete action metadata: target repository, priority (`P1`/`P2`/`P3`), dependency links, and required skill bindings.

### 2.2 Deduplication ledger & transaction receipting
- Maintain an append-only transaction ledger at `trm-drive/inbox/ledger.jsonl`.
- Before staging a task to `.harness/tasks/pending/`, verify whether the SHA-256 fingerprint or action ID already exists in the ledger.
- Receipt processed tasks by copying a receipt card to `trm-drive/inbox/outbox/` for mobile sync confirmation.

---

## 3. Protocol decisions & verification rules

1. **Fail-closed schema validation**:
   - Extracted task objects must validate against the harness JSON schema before placement in `.harness/tasks/pending/`.
   - Malformed payloads are rejected to `quarantine/` with an actionable diagnostic record.
2. **Zero-token-waste routing**:
   - Simple tasks (spelling corrections, lint fixes, sync commands) are routed directly to local Tier 2 models or deterministic bash/node scripts.
   - Only ambiguous or cross-architectural requests are escalated to Tier 1 frontier models.

---

## 4. References & linked topics
- [[Index]]
- [[TrmResearchGaps|trm-research-gaps]]
- [[Log]]

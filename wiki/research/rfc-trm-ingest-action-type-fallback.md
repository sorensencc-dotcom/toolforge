---
title: "RFC: TRM Ingestion Action Type Inferencing & Resilient Schema Fallback"
category: "research"
topic: "rfc-trm-ingest-action-type-fallback"
gap_id: "act-trm-ingest-action-type-fallback"
status: "draft"
created_at: "2026-10-03T16:30:00.000Z"
assigned_tier: "Tier 2 (Execution)"
routed_model: "claude-3-5-sonnet-20241022"
router_confidence: 0.85
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: null
citations:
  - "scripts/trm-ingress-watcher.mjs"
  - "tests/trm-ingress-routing.test.mjs"
  - "kb-sync/scripts/trm-ingest-drive.mjs"
---

# RFC: TRM Ingestion Action Type Inferencing & Resilient Schema Fallback

## 1. Problem statement & ingress failure modes

In mobile and asynchronous out-of-band ingress pipelines (Google Drive `.gdoc` stubs, mobile drop cards, multi-agent mailboxes), action payloads frequently omit or underspecify the `action_type` field:
1. **Strict schema rejection**: Early ingress implementations strictly asserted `['deterministic_fix', 'antigravity_triage'].includes(item.action_type)`, rejecting valid mobile drop requests if `action_type` was omitted or specified as a generic label (e.g. `action`, `task`, `fix`).
2. **Loss of operational velocity**: Manual mobile notes or quick triage drops were diverted into quarantine or rejection outboxes, requiring manual re-keying.

---

## 2. Deterministic inferencing & fallback rules

To ensure fault-tolerant ingestion without sacrificing routing precision, `validatePayload` and `inferActionType` apply deterministic normalization rules:

### 2.1 Precedence order
1. **Explicit valid type**: If `action_type` is already `'deterministic_fix'` or `'antigravity_triage'`, preserve it.
2. **Intent & keyword heuristic**: If the normalized text of `intent`, `summary`, or `category` starts with or includes known deterministic remediation prefixes (`fix_`, `remediate_`, `prune_`, `quarantine_`, `clean_`), assign `'deterministic_fix'`.
3. **Default safe fallback**: Default all other unmapped payloads to `'antigravity_triage'`.

---

## 3. Verification & test matrix

Unit tests in `tests/trm-ingress-routing.test.mjs` verify:
- Graceful normalization without throwing unhandled exceptions.
- Deterministic fix routing for self-healing automations.
- Zero data loss for mobile Google Drive drops lacking explicit frontmatter typing.

---

## 4. References & linked topics
- [[Index]]
- [[trm-research-gaps]]
- [[trm-drive-transport-adapter-spec]]
- [[Log]]

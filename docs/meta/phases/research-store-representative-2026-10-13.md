# Contextual retrieval acceptance

Result: **REJECTED**. Contextual Markdown repair passes structural regressions; retrieval does not meet frozen quality gate. No tuning threshold candidate qualifies. Default `0.7` and pinned local model remain unchanged.

## Evidence

Same seven approved snapshots supply 117,706 source bytes. Production parser now emits 291 contextual blocks instead of 476 blank-line paragraphs, preserves Markdown block integrity, and excludes standalone headings/rules. Source body hashes remain unchanged. See [Chunking and label audit](research-store-chunking-audit-2026-10-13.md).

New manifest SHA-256: `33dd9f24bc37ecb2bcb8cd1c385c33620480b36d42f82748fa9095d8424579ae`. All 70 questions differ from previous scored questions. Freeze precedes scoring: tuning contains 14 positives and four negatives; validation contains 28 positives, 12 confusing negatives, and 12 unrelated negatives. Anchors match answer-bearing text rather than inherited headings. Same agent authored labels; no independent annotation or exhaustive human answer-quality assessment.

Actual sync CLI indexed temporary exports into dev/UAT `bhezixgmkhpndmezgsxk`; actual MCP stdio and signed CIC/RewriteLabs readers searched globally authorized results without fixture filtering or reranking. Identity pinned before/after: `ollama:qwen3-embedding:4b@df5bd2e3c74cd8d069d21dc038f1b359fcdc9458fce1c99bd43c9eb1518ff907:1536`. All exports use UNKNOWN status, with shared governance provenance retained. Zero external embedding requests.

## Measurements

| Set | Expected-passage hits at 0.7 | Negative false accepts |
| --- | --- | --- |
| Tuning | 1/14 (7.1%) | 0/4 |
| Validation | 3/28 (10.7%) | 0/24 |
| Validation CIC | 2/24 (8.3%) | - |
| Validation RewriteLabs | 1/4 (25.0%) | - |

Tuning has 8/14 strict expected-passage top matches at threshold zero, so lowering threshold cannot repair the ranking gate. No 0.01-grid candidate satisfies >=90% overall recall, >=80% per project, and zero negative acceptance. Validation therefore runs once at unchanged 0.7. Validation has 15/28 expected-passage top matches at threshold zero, diagnostic only; no retuning from those scores.

Signed opposite-project filters returned no results. UNKNOWN run documents remained excluded under VERIFIED filter. Foreign-project duplicate control stayed inaccessible. MCP threshold behavior matched measured scores for every validation query. Final model identity, independent document/chunk cleanup, temporary-user deletion/absence, and temporary-export removal all passed. No runtime error. Initial credential lookup failed before database writes or scoring; bounded CLI access retry recovered without replaying queries. Successful attempt completed `2026-10-13T04:39:54.684Z`.

## Limits and next action

Different fresh question sets prevent a causal before/after accuracy comparison. Anchor labels are not exhaustive acceptable-answer labels. One RewriteLabs source and infrastructure/governance-only corpus do not establish production research quality. One evidence-status bucket tests exclusion, not mixed-status ranking. Both validation sets are now spent; preserve them as evidence.

Serial regression suite passes 37/37. Concurrent CPU-inference run hit existing five-second MCP startup timeout (36/37); no timeout relaxation. Documentation inventory and scoped whitespace checks pass. Full root suite and rollback SQL suite were not rerun for this parser-only change. No schema/Auth settings, baseline data, automatic reindex, model, threshold, or production changes.

Next quality experiment needs human-reviewed answer labels and a newly frozen validation set before any model, query-format, or ranking proposal. No rollout-quality approval.

Detailed evidence: [Frozen labels and measured results](research-store-representative-2026-10-13.json).

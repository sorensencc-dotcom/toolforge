# Research store chunking audit

## Scope

Inspect saved representative results without rerunning spent validation. Original gate remains rejected. Repair Markdown chunk boundaries in shared sync parser; retain source hashes, atomic replacement, embedding identity, and threshold 0.7. No SQL, Auth, production, or automatic reindex change.

## Findings

Original 476 paragraph chunks include 108 standalone headings and 46 standalone separators. Headings ranked first for six tuning positives and four validation positives. Bare section titles do not answer those questions. Blank-line splitting also breaks fenced examples and loses section context.

Original labels omit defensible alternate passages: tuning-8 returned the repository-root helper implementation; validation-10 returned the cwd-anchoring implementation summary; validation-11 returned deferred-directory context; validation-41 returned the discovery merge implementation. Other partial matches require human judgment. These observations do not retrospectively change scores or acceptance.

## Repair and verification

Use pinned Marked lexer for top-level blocks. Attach current heading ancestry to each nonempty answer-bearing block; omit standalone headings and rules. Preserve fenced code, tables, and lists. Enforce 8000-character limit including context, and record authoritative `markdown-context-v1` metadata. Existing claim invalidation applies when reindexing changes evidence text.

Four regression tests failed before repair and pass afterward. Skill suite: 37/37. Offline replay of approved source bytes produces 291 contextual blocks, zero standalone headings/rules, and unchanged body hashes for all seven sources. Largest block: 3235 characters. This proves chunk structure, not retrieval quality.

Fresh query experiment uses same approved source snapshots, local pinned embedding, and dev/UAT destination. New manifest has 18 tuning queries and 52 validation queries (28 positives, 12 confusing negatives, and 12 unrelated negatives). Same agent authored labels; no independent annotator or exhaustive answer-quality judgment. Match anchors only within answer-bearing text. Preserve old experiment and never retune from new validation scores.

## Evidence

Prior measured scores: [Representative report](research-store-representative-2026-10-12.md). Private offline reconstruction and fresh frozen runner remain in ignored `.artifacts/research-store-representative-2026-10-12` and `.artifacts/research-store-representative-2026-10-13`. Fresh manifest SHA-256: `33dd9f24bc37ecb2bcb8cd1c385c33620480b36d42f82748fa9095d8424579ae`.

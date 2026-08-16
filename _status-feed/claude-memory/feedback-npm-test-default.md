---
name: npm-test-default-policy
description: "Tests must always use `npm test`, never direct `npx jest` calls"
metadata: 
  node_type: memory
  type: feedback
  project: cic-ingestion
  date: 2026-06-15
  originSessionId: a9deac7d-e868-4c54-938d-571b7e9264a3
---

**Rule:** ALL test execution must use `npm test` (not `npx jest` directly).

**Why:** The `npm test` script invokes `scripts/test-setup.js` which sets batch approval context. This eliminates per-tool prompts during test runs. Direct `npx jest` bypasses the hook entirely.

**How to apply:** 
- NEVER run `npx jest`
- NEVER run `npx jest src/...`
- ALWAYS run `npm test` or `npm test -- src/...`

**Skill policy update needed:** Add rule to skill-contribution-pipeline and code-review agents that flags `npx jest` usage in test commands as non-compliant.

**Related:** [[test-hook-batch-approval-pattern]]

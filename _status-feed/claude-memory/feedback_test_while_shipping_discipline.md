---
name: feedback_test_while_shipping_discipline
description: "Write 1 integration test per commit (happy path + edge case, 3-5 min). Keeps test ratio >10% naturally."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 65afdf33-c6db-4928-8454-5657614a1afc
  modified: 2026-07-22T00:31:23.076Z
---

**Rule:** When committing code changes, write 1 integration test simultaneously covering: (1) happy path, (2) one edge case. Target: 3-5 minutes per test. Never commit without a test.

**Why:** Test coverage rots when written post-hoc ("we'll test it later"). Commits with zero tests bloat debt. Writing tests DURING commit:
- Catches logic bugs before push
- Forces spec clarity (test forces you to name expected behavior)
- Keeps coverage ratio >10% naturally without backfill sprints
- 3-5 min per test = ~10% commit time cost, not 40% in batch mode

**How to apply:**
- Before `git add`, ask: "What behavior am I shipping? What breaks if I'm wrong?"
- Write 1 test that covers both
- Patterns: for a fix, test the bug is gone + one side effect; for a feature, happy path + one boundary
- For pure refactoring: minimal test (test output unchanged)
- Exception: infrastructure/docs-only commits skip tests

**Recognition pattern:** User flag if test ratio drops below 8% or commits appear without tests in same session.

**Related:** [[feedback_batch_pushes_per_session]] (one push per session consolidates test debt). [[learning-codex-cli-location]] (codex can write test scaffolds fast).

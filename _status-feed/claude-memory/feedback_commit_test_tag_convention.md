---
name: feedback-commit-test-tag-convention
description: "Commits primarily adding test coverage get test: prefix, even when touching non-test files too"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ce635f64-469e-4944-83df-477f3168ba39
  modified: 2026-07-29T16:38:02.247Z
---

Commit whose primary content is test coverage → `test:` prefix (or at minimum co-tag), even if it touches non-test files.

**Why:** Retro 2026-07-29 found most test-file changes that week rode inside `fix:`/`feat:` commits, undercounting real test investment in commit-type breakdown.

**How to apply:** When drafting a commit message, check whether test files are the primary content (not incidental to a fix/feat). If yes, use `test:` as the type prefix. Applies going forward from 2026-07-29; documented in [CLAUDE.md](../../../../dev/CLAUDE.md) Productivity Discipline item 4.

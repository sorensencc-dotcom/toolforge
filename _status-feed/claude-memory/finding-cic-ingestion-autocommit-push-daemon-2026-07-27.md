---
name: finding-cic-ingestion-autocommit-push-daemon-2026-07-27
description: "cic-ingestion repo has something auto-committing + auto-pushing working-tree edits to origin/master without an explicit git commit/push call in the session."
metadata:
  type: finding
  originSessionId: d0bddb46-1770-430a-a668-ee0f4c688ce6
  modified: 2026-07-27T17:56:36.492Z
---

Built OCR endpoint (`/api/analyze/ocr`) in c:\dev\cic-ingestion this session
via Edit tool only -- never ran `git add`/`git commit`/`git push`. Checked
`git status` at session wrap: those edits were already inside commit
`b41c3055` ("feat(testing): finalize image analysis and resilience test
suites"), and `master` was already even with `origin/master` (confirmed via
`git branch -vv`). Something committed and pushed the working tree during the
session on its own.

**Why:** [[feedback_push_discipline_hook]] is a *check* (flags unpushed
commits at session end), not a pusher -- this behavior is different: it
authored a commit message and pushed to GitHub without a git command from
me or an explicit user "push" instruction. Likely an ijfw session-end hook
(`.ijfw/` state files changed in the same window) or a repo-local watcher,
not confirmed which.

**How to apply:** Before claiming "nothing's committed yet" or asking the
user whether to commit/push in cic-ingestion, run `git status` /
`git branch -vv` first -- assume it may already be live on origin. If this
recurs in other repos, it's worth identifying the actual mechanism (check
`.ijfw/` hooks, `.git/hooks/`, any file-watcher) since silent pushes to a
real GitHub remote without a stated approval step cuts against the git
safety protocol (destructive/shared-state actions should be confirmed).

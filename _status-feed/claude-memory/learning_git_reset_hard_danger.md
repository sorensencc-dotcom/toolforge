---
name: learning-git-reset-hard-danger
description: "git reset --hard destroys ALL uncommitted work, not just targeted commits—unsafe when working tree isn't pristine"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0df381f-758f-4ca2-a228-6908dcc220f7
  modified: 2026-07-19T19:23:43.506Z
---

**Rule**: `git reset --hard` is not a safe isolation/containment tool for "undo these specific commits" when other uncommitted work coexists in the same tree.

**Why**: `git reset --hard` discards ALL uncommitted changes, not just the bad commit(s). 2026-07-16 incident: single `reset --hard` to revert one bad commit also destroyed 2 unrelated uncommitted edits, permanently lost one (.claude/settings.json, no backup).

**How to apply**:
- **If working tree is pristine**: `git reset --hard` is safe
- **If uncommitted work exists**: Use alternatives:
  - `git stash` before reset, then `git stash pop`
  - `git checkout -- <specific-path>` to revert only target files
  - Cherry-pick wanted changes to a temp branch first, then reset
  - NEVER `reset --hard` with dirty working tree

**Pattern**: Before any destructive git operation, always run `git status` first. If output is not clean, use a preserve-work alternative.

**Reference**: [[incident_git_reset_data_loss_2026-07-16]]

---
name: incident-git-reset-data-loss-2026-07-16
description: Subagent containment attempt destroyed uncommitted work; .claude/settings.json permanently lost
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0df381f-758f-4ca2-a228-6908dcc220f7
  modified: 2026-07-19T19:20:21.883Z
---

**Incident**: Subagent committed to main instead of isolated worktree. Containment used `git reset --hard` which destroyed ALL uncommitted changes, not just the bad commit.

**Sequence**:
1. Task 1 subagent committed to main (wrong checkout, caught)
2. Controller ran `git reset --hard` to revert the commit
3. Reset also destroyed 2 unrelated uncommitted edits on main
4. 2 of 3 recovered from captured diff text/system reminders
5. 1 file permanently lost: `.claude/settings.json` (no backup existed)

**Root Cause**: `git reset --hard` is not a safe isolation tool for "undo these 2 commits" when other uncommitted work coexists. It discards ALL uncommitted changes indiscriminately.

**Why**: Subagent checkout failures (silent cd failure, wrong git worktree) + unsafe containment tool = catastrophic data loss.

**How to apply**: 
- Subagents MUST verify checkout on first bash command: `cd <path> && git rev-parse --show-toplevel && git rev-parse HEAD` checked against expected values
- Containment of bad commits: use `git stash` (preserve uncommitted work) or `git checkout -- <specific-path>` after cherry-picking wanted changes, NEVER `git reset --hard` when working tree isn't pristine
- Critical config files (.claude/settings.json, CLAUDE.md, etc.) need backup/version-control strategy

**Date**: 2026-07-16, docs-meta-restructure branch, subagent dispatch Task 1
**Reference**: [[learning_subagent_cd_verification]], [[learning_git_reset_hard_danger]]

---
name: learning-hooks-generator-source-of-truth
description: setup-git-hooks.ps1 is the single source of truth for installed .git/hooks/pre-commit.ps1 and pre-push; editing the installed file directly is silently overwritten next install.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f331c20b-5904-416f-970d-20cf06301818
---

`c:\dev\.git\hooks\pre-commit.ps1` and `pre-push` are auto-generated from heredoc templates in `c:\dev\setup-git-hooks.ps1`. The installed files literally say "Auto-generated ... Do not edit." — it's true, not boilerplate. Any direct edit to the installed hook is lost the next time someone runs `setup-git-hooks.ps1 -Action Install`.

**Why:** Discovered while fixing hook scoping ([[session-wrap-2026-07-17-hook-scoping]]) — almost edited the installed file before finding the real generator via `grep -rl "Auto-generated pre-commit hook"`.

**How to apply:** Before editing any `.git/hooks/*` file in this repo, grep for its header text across `*.ps1` first to find the generator. Edit the generator, then re-run `-Action Install` to propagate.

---
name: project-trm-vault-deliberately-local-only
description: "trm-vault has a pre-push hook that hard-blocks any remote push, by design — confirmed 2026-08-02, do not bypass without re-confirming with user."
metadata: 
  node_type: memory
  type: project
  originSessionId: 009826b5-8abf-41e6-a20e-347ce01695f9
  modified: 2026-08-02T04:35:04.635Z
---

`C:\Users\soren\trm-vault\.git\hooks\pre-push` unconditionally refuses any push, with message: "this repo must never have a remote or push destination... do not remove this hook to work around it." This matches trm's own README safety guardrail (`assertSafeRoot` in `C:\dev\trm\src\core\rootSafety.ts`): TRM data must never risk being committed/pushed to a remote.

**Why:** deliberate design from an earlier session, not an oversight. TODOS.md previously mischaracterized this as a plain gap ("no git remote") — corrected 2026-08-02 after actually testing it.

**What happened 2026-08-02:** user asked to push trm-vault, gave a private GitHub repo URL (`sorensencc-dotcom/trm-valut`). Added the remote, `git push` was blocked by the hook. Surfaced this to the user with full context (hook text, repo is private, matches trm's own design intent); user chose to respect the guardrail and had the remote removed rather than bypass it.

**How to apply:** don't re-add a remote or bypass this hook on a bare "push trm-vault" request — resurface this context first, since the user may not remember the guardrail exists. If off-machine backup is wanted, it needs a non-git path (scheduled zip/robocopy, etc.), not `git push`. See [[feedback_trm_vault_commit_per_run]] for the separate (still-open) local commit-discipline rule, which is unaffected by this — commit locally after every run, just don't push.

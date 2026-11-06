---
name: start-session-preflight
description: Run the mandatory repository-context preflight and load STATUS.md at the start of work in any repo under C:\dev, then give a terse brief (goal, done, decisions, tests, blockers, next action). Use whenever the user says "start session", "preflight", "where did we leave off", "begin work on <repo>", "resume work on <repo>", or opens a session on a C:\dev checkout, even if they never mention preflight or STATUS.md. Run this before any repo read, write, test, commit, or push.
compatibility: |
  - Runtime: Node.js 18+, PowerShell 7 (pwsh)
  - Dependencies: C:\dev\scripts\verify-repo-context.ps1
  - Permissions: read:repo
---

# Start-session preflight

C:\dev holds many checkouts, and a wrong guess about which one you are in corrupts the wrong repo. The preflight script fails closed, so run it and trust its verdict instead of re-deriving repo state by hand.

## Trigger

"start session", "preflight", "where did we leave off", "begin work on <repo>".

## Steps

1. **Get the root.** Use the canonical absolute repo root the user named. If they gave a repo name only, resolve it to `C:\dev\<name>` and confirm it exists. If it is unclear, list candidate checkouts under `C:\dev` (and the current worktree) and ask. Never infer from cwd when more than one checkout exists. Never create files or temp workspaces directly in `C:\dev`.

2. **Run the preflight:**
   ```powershell
   pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path <root>
   ```
   Add `-ExpectedRepository` / `-ExpectedBranch` when the user stated them. It fails on a relative path, a path nested below the Git root, a detached HEAD, a missing `package.json`, or a repo/branch mismatch. On failure, print the script's error line verbatim, report `PREFLIGHT: FAIL`, and stop. Do not read, edit, test, or commit in that repo until the user fixes the path or confirms another root.

3. **Read `<root>\STATUS.md`.** It is the shared session contract file. If missing, say so and continue with an empty brief.

4. **Output the brief**, nothing more:
   ```
   PREFLIGHT: PASS  <root>  <branch>
   Active goal: ...
   Completed work: ...
   Decisions: ...
   Tests: ...
   Blockers: ...
   Next action: ...
   ```
   One line per field, quoting STATUS.md rather than paraphrasing, `none` for empty fields. Skip re-reading AGENTS.md; its rules are already in context.

`node skills/start-session-preflight/src/index.mjs <root>` performs steps 2-4 deterministically and exits 1 on failure.

## Input Schema

```typescript
interface PreflightInput {
  root: string;                // Required. Absolute repo root.
  expectedRepository?: string;
  expectedBranch?: string;
}
```

## Output Schema

```typescript
interface PreflightOutput {
  pass: boolean;
  text: string;                // Brief, or "PREFLIGHT: FAIL" plus the first error line
}
```

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**

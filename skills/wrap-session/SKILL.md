---
name: wrap-session
description: End-of-session ritual for repos under C:\dev - decide whether a retro is needed, update STATUS.md, then push and verify. Use whenever the user says "wrap session", "wrap up", "end session", "wrap and push", "we're done for today", or "update STATUS.md and push", even if they name only one of those steps. Skips /retro automatically when no commits landed since the last same-day retro.
compatibility: |
  - Runtime: Node.js 18+, PowerShell 7 (pwsh)
  - Dependencies: scripts/check-retro-needed.ps1, git
  - Permissions: read:repo, write:file, write:git
---

# Wrap session

AGENTS.md makes a clean session end mandatory: STATUS.md current, retro only when there is something new, work pushed. A fixed order avoids both skipped steps and duplicate retros.

## Trigger

"wrap session", "wrap up", "end session", "wrap and push".

## Steps

1. **Retro gate.** From the repo root run:
   ```powershell
   pwsh -NoProfile -File scripts/check-retro-needed.ps1
   ```
   Exit 1 means no commits since the last same-day retro: skip the retro and say so. Exit 0: run `/retro`. Do not write `.context/retros/inbox/` entries; the retro policy is still a DRAFT pending Tier 1 approval.

2. **Update STATUS.md.** Edit in place and keep the Toolforge vault-pointer block untouched. Add or refresh a dated `## Session wrap (YYYY-MM-DD)` section with: Active goal, Completed work, Decisions, Tests, Blockers, Next action. State only what was done and verified this session; mark anything unverified as such. `buildStatusSection` and `insertSection` in `src/index.mjs` produce and place the section.

3. **Check the tree.** Run `git status --short` and `git log @{u}..HEAD --oneline`. Commit leftover work with the right prefix:
   - mostly test coverage: `test:`
   - bulk or automated resync (for example a large `.ijfw/` regen): `chore(sync):`
   - lockfiles never count toward LOC claims.
   End commit messages with the attribution line from the session system reminder.

4. **Push and verify.** Push the current branch normally. Never push to `main` directly (branch first), never force-push, never use `--no-verify`. If a hook fails, fix the cause. Confirm with `git status -sb` that the branch shows no ahead count, then report the branch name and head commit.

5. **Report** in three lines or fewer: retro run or skipped, STATUS.md updated, push verified (or what blocks it).

If the user's wording did not mention pushing, do steps 1-3 and ask before step 4. Run any test command under `timeout 60`; a suite silent past 60s is hung, so abort it and report the file.

## Input Schema

```typescript
interface WrapInput {
  date: string;                // YYYY-MM-DD
  goal?: string;
  done?: string;
  decisions?: string;
  tests?: string;
  blockers?: string;
  next?: string;
}
```

## Output Schema

```typescript
type RetroDecision = "run" | "skip";   // from check-retro-needed.ps1 exit code
// buildStatusSection(): string (markdown); insertSection(): string (updated STATUS.md)
```

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**

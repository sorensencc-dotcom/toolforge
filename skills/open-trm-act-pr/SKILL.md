---
name: open-trm-act-pr
description: Take a TRM/ICF ticket (GitHub issue number or "act" item) from branch to opened pull request using this repo's conventions - trm/act-<slug> branch, tests, scoped commit, PR body with Why/Scope/Tradeoffs/Blast Radius, and "closes #N". Use whenever the user says "act on ticket", "trm act", "fix issue #N and open a PR", "implement #N", or hands over a triage card to ship, even if they do not mention branch naming or the PR format.
compatibility: |
  - Runtime: Node.js 18+
  - Dependencies: git, gh CLI
  - Permissions: read:repo, write:file, write:git, write:github
---

# Open a TRM act PR

Recent merges (#226, #227) share one shape. Following it keeps review cheap and lets triage tooling link PRs back to tickets.

## Trigger

"act on ticket", "trm act", "fix issue #N and open a PR", "implement #N".

## Steps

1. **Preflight.** Run `start-session-preflight` for the repo if it has not run this session. Read the issue (`gh issue view <N>`) and restate the acceptance criteria in one line each.

2. **Branch** from the up-to-date base `main`: `trm/act-<short-kebab-slug>`, with the issue number in the slug when there is one (for example `trm/act-218-link-scrubber-resilience`). If this session already runs in a worktree with its own branch, use that branch.

3. **Implement** the smallest change that meets the criteria. Find code with `graft ask` / `graft callers`; broad workspace greps are blocked by hook.

4. **Test.** Write or extend tests alongside the change. Wrap every run: `timeout 60 npm test` or the targeted script. A run silent past 60s is hung: abort, clear `.staging.lock` / `.kb-sync.lock`, and report the file. Report real output; never claim a pass you did not see.

5. **Commit** with Conventional Commits and a closing keyword: `chore(icf): <what> (closes #N)`, `fix(trm): ...`, `feat(...)`. A commit that is mainly tests uses `test:`. Do not bump the version here; `chore(release)` is a separate commit. End the message with the attribution line from the session system reminder.

6. **Push and open the PR** with `gh pr create`. Title mirrors the commit subject. Body sections, in order: Why, Scope, Tradeoffs, Blast Radius, Tests. End with the PR attribution line from the session system reminder. The helpers in `src/index.mjs` build the branch name, subject, and body.

7. **After opening:** call `mcp__ccd_pr__get_status`, then `bind_pr` if the PR is not reported. Let the app watch CI; do not poll it. Never enable auto-merge unless asked.

Confirm with the user before pushing if the branch would touch `main` or another person's branch. PR prose follows `skills/writing-heuristics/SKILL.md`.

## Input Schema

```typescript
interface ActPrInput {
  issue?: number;
  slug: string;                // Required.
  type?: string;               // Default "chore".
  scope?: string;
  summary: string;             // Required.
  why: string; tradeoffs: string; blastRadius: string; tests: string;
  scopeItems?: string[];
}
```

## Output Schema

```typescript
interface ActPrOutput {
  branch: string;              // trm/act-...
  subject: string;             // Conventional Commit subject with (closes #N)
  body: string;                // PR markdown
}
```

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**

For a worked example from PR #227: **→ See [docs/USAGE.md](./docs/USAGE.md)**

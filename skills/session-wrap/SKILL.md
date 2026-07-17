---
skill_name: session-wrap
version: 1.1.0
name: session-wrap
category: session-management
description: Atomic session wrap-up — doc updates, scoped git staging, prefixed commit, structured report
author: Soren (Cast Iron Forge)
tags: ["session-wrap", "git-commit", "documentation", "atomic-commit"]
---

# Session Wrap — Session Termination Commit Engine

**Status: ACTIVE**
**Version: 1.1.0**
**Category: session-management**
**Owner: soren**

---

## Purpose

Orchestrate four session-end tasks as one operation: write doc updates, stage the
relevant changes, create a prefixed atomic commit, and generate a summary report.

Migrated from the global `~/.claude/skills/session-wrap.md` skill (v1.0.0). **Not**
a duplicate of gstack `/retro` — this skill does git mechanics and doc writes, it does
not mine transcripts for lessons learned. Run `/retro` separately for that.

## v1.1.0 Changes (deep review)

The v1.0.0 global skill always ran `git add -A`. That stages every dirty file in the
repo, including unrelated in-progress work from a concurrent session — exactly the
collision pattern already hit twice in this project (2026-07-15, 2026-07-16 concurrent
cowork rebase collisions). v1.1.0 defaults to staging only:

1. paths just written via `docUpdates`, plus
2. paths explicitly passed in `stageFiles`

`git add -A` now requires an explicit `stageAll: true` opt-in. Also added: commit
message prefix is validated and rejected (not just documented), missing prefix or an
empty stage set fails cleanly instead of producing a bad/empty commit, and `dryRun`
previews the plan without touching git.

## Inputs

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `commitMessage` | string | required | Must start with `[claude]`, `[copilot]`, `[gemini]`, or `[human]` |
| `summary` | string | optional | Session summary text for the report |
| `docUpdates` | array | optional | `{path, content}` objects; parent dirs created as needed |
| `stageFiles` | array | optional | Explicit paths to `git add`, on top of `docUpdates` paths |
| `stageAll` | boolean | optional, default `false` | Opt into `git add -A` |
| `dryRun` | boolean | optional, default `false` | Compute the plan, skip writes/git |

## Outputs

```
{
  success: boolean,
  commitHash: string | null,
  docUpdates: { path, status }[],
  stagedFiles: string[],
  skippedCommit: boolean,      // true if nothing was staged
  report: {
    summary: string,
    checklistItems: string[],
    nextSteps: string[]
  }
}
```

## Exit Behavior

- Bad commit prefix → throws `BAD_COMMIT_PREFIX`, no writes performed.
- Nothing staged after resolution → `skippedCommit: true`, `success: true`, no commit
  created (this is not an error — a wrap with only a report is valid).

## Implementation

**Location:** `src/index.ts`
**Dependencies:** Node.js `fs`, `child_process` (`git`)
**Execution:** validate → write docs → resolve stage set → git add → git commit → report

## See Also

- `docs/USAGE.md` — worked examples
- CLAUDE.md commit attribution convention (`[tool]` prefixes)
- `pre-wrap-audit` — the 12-point readiness gate this often runs *before*

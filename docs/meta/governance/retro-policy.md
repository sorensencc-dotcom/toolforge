# Retro policy

Status: APPROVED by Tier 1 on 2026-10-18. Nothing enforces this policy yet.
Owner: Chris Sorensen
Effective date: 2026-10-18

This policy names the only places that hold retros and retro findings, who may write them, how long they stay, and how a finding becomes an action. It applies to every agent (Claude, Codex, Grok, Gemini, Copilot, and Antigravity), every person, and every CI job that works in a repository under `C:\dev`.

## Terms

- **Retro.** A dated JSON record that a `/retro` run writes in the format of the [retro schema](../../../.context/retros/RETRO-SCHEMA.md).
- **Retro finding.** One observation inside a retro inbox entry, in the format of the [retro inbox spec](../../../.context/retros/INBOX-SPEC.md).
- **Not a retro.** Session wraps, memory notes, handoffs, and run logs. They can mention a finding, but they never record one.

## Sanctioned write paths

| Output | Path | Format | Writer |
|---|---|---|---|
| Retro | `<repo>/.context/retros/<YYYY-MM-DD>-<N>.json` | Retro schema v1.x | The `/retro` skill |
| Retro finding | `<repo>/.context/retros/inbox/<agent>/<YYYY-MM-DD>-<slug>.json` | `retro-inbox/1` | The agent that `<agent>` names |
| Harvest ledger | `<repo>/.context/retros/harvest/ledger.jsonl` | One JSON line per harvested finding, per the retro inbox spec | The retro harvester |

No other location holds retros or retro findings. The ICF weekly report in `C:\dev\.icf-retros\weekly\` is generated output, and only the weekly retro scripts, such as `scripts/compile-weekly-retro.mjs`, write it.

## Forbidden locations

Never write a retro or a retro finding to these locations. The counts come from a scan of this machine on 2026-10-17.

| Class | Paths | Found |
|---|---|---|
| Run logs | `logs/retro/`, `logs/retro-audit-*.log` | 34 and 31 files in `C:\dev\logs` |
| gstack global retros | `~/.gstack/retros/` | 1 file, `global-2026-08-13-1.json` |
| Agent scratch directories and private worktrees | `~/.codex/worktrees/`, `~/.grok/worktrees/`, `~/.codex/memories/`, and the repo-local `.codex/`, `.gemini/`, and `.grok/` | 3 Codex and 2 Grok worktrees with their own `.context/retros/`, and 2 Codex rollout summaries about retro work |
| Memory directories and session wraps | `~/.claude/projects/*/memory/`, `_status-feed/claude-memory/` | 134 session wraps and 14 retro-named notes in the `c--dev` memory directory, and 105 wraps mirrored in `_status-feed/claude-memory/` |

Session wraps and memory notes are not retros. When a wrap or a memory note mentions a finding, file the finding in the inbox as well.

## Who may write

- Each agent writes only in its own directory, `.context/retros/inbox/<agent>/`. A person writes as `human`. A CI job and the retro harvester write as `ci`.
- Write a new file for each session. Never edit or delete another agent's entry.
- Before you commit an entry, run `node scripts/validate-retro-inbox.mjs`. When it reports a duplicate id, drop your copy of the finding.

## Retention

- **Retros.** Keep every dated retro. The daily retro full audit validates the whole history, which starts at `2026-07-12-1.json`. Because `.gitignore` line 128 ignores `.context/retros/`, commit each new retro with `git add -f`.
- **Retro findings.** Keep every committed entry as the audit record. Change a committed entry only to fix a validation error. Archival rules arrive with the planned consolidator.
- **Run logs.** This policy sets no retention for logs.

## Finding-to-action rule

1. A finding with `suggestion` must become exactly one action. A finding without `suggestion` stays a record.
2. Severity sets the priority. `critical` maps to P0 and `high` maps to P1. Both `medium` and `low` map to P2.
3. P2 actions enter TODOS.md automatically. P0 and P1 actions enter TODOS.md only after Tier 1 approval.
4. The action reuses the finding id. TODOS.md carries the id in a `<!-- retro-finding: RF-... -->` marker, and the ICF weekly report uses it as the action `sourceId`. A repeated id never creates a second action.
5. `INBOX_REGISTRY` in `scripts/validate-retro-inbox.mjs` holds these mappings. Tools read the registry and never restate the rules.

`scripts/consolidate-retro-inbox.mjs` applies this rule. TODOS.md is gitignored, so the consolidator runs locally and CI validates only the inbox.

## Harvester configuration

Tier 1 approves every change to `.context/retros/harvest/config.json`, including `categoryTags`, `severity`, and the repo list. A wrong tag stays in the committed record. Operator approval recorded 2026-10-18.

## Prerequisites before agents write entries

Tier 1 approved this policy on 2026-10-18, so agents and the retro harvester may now write inbox entries. The two technical blockers were fixed before approval:

1. `.context/retros/validate-changed.ps1` validates only dated retros, so inbox entries no longer fail the `retro-schema` job. `.context/retros/test-v1.0.ps1` covers this.
2. `.gitignore` re-includes `.context/retros/inbox/`, so a plain `git add` tracks new entries.

## Enforcement plan

Nothing below enforces this policy today. Every gate is PLANNED.

| Mechanism | Plan | Status |
|---|---|---|
| Validator CLI | `node scripts/validate-retro-inbox.mjs` checks shape, registries, ids, paths, and duplicate ids. | Exists. Runs only by hand, and no gate calls it. |
| CI job | A `.github/workflows/governance.yml` job runs the validator on every PR that touches `.context/retros/inbox/`. | PLANNED |
| Pre-commit gate | `setup-git-hooks.ps1` adds an inbox check for staged entries to the generated `.git/hooks/pre-commit.ps1`. | PLANNED |
| Retro full audit | `.github/workflows/retro-full-audit.yml` validates the inbox next to the retro history. | PLANNED |

## Changes

Changes to this policy, or to the registries in the retro inbox spec, need Tier 1 approval.

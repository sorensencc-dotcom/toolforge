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
| Action ledger | `<repo>/.context/retros/actions/ledger.jsonl` | One JSON line per decision, per [Action ledger](#action-ledger) | `node scripts/retro-action-ledger.mjs append`, run by a person or by an agent that a person told to record the decision |

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
- **Retro findings.** Keep every committed entry as the audit record. Change a committed entry only to fix a validation error. Keep every action ledger line. Archival rules arrive when the inbox outgrows the report.
- **Run logs.** This policy sets no retention for logs.

## Finding-to-action rule

1. A finding with `suggestion` must become exactly one action. A finding without `suggestion` stays a record.
2. Severity sets the priority. `critical` maps to P0 and `high` maps to P1. Both `medium` and `low` map to P2.
3. P2 actions enter TODOS.md automatically. P0 and P1 actions enter TODOS.md only after Tier 1 approval, which the action ledger records as an `approved` event.
4. The action reuses the finding id. TODOS.md carries the id in a `<!-- retro-finding: RF-... -->` marker, and the ICF weekly report uses it as the action `sourceId`. A repeated id never creates a second action.
5. `INBOX_REGISTRY` in `scripts/validate-retro-inbox.mjs` holds these mappings. Tools read the registry and never restate the rules.

`scripts/consolidate-retro-inbox.mjs` applies this rule. TODOS.md is gitignored, so the consolidator runs locally, and `scripts/run-weekly-retro.ps1` runs it before each weekly report. CI validates only the inbox.

## Action ledger

The action ledger is the tracked record of what happened to each action. TODOS.md is a local view of it and never the only record.

- **Format.** One JSON object per line with `id`, `state`, `by`, `date`, and an optional `ref`. `id` is a finding id from the inbox. `state` is `approved`, `closed`, or `dismissed`. `by` names the person who decided. `date` is a `YYYY-MM-DD` calendar date. `ref` points to the evidence, such as a pull request URL or a chat date.
- **Append only.** Never edit or delete a line. The last event for an id decides its state, so a reversal is a new line.
- **Tier 1 approval.** A P0 or P1 action enters TODOS.md only when its latest event is `approved`. Only a person with Tier 1 authority may state the approval, in the conversation or in a pull request. An agent never infers it, and it records the event only after a person states the approval.
- **Closed and dismissed.** The consolidator never appends a `closed` or `dismissed` action again, even when its TODOS.md line is gone. The weekly report marks a `closed` action completed and omits a `dismissed` one.
- **Writing.** Run `node scripts/retro-action-ledger.mjs append --id <RF-id> --state <state> --by <name>`. The command rejects an id that the inbox does not hold. Run `node scripts/retro-action-ledger.mjs validate` to check the file.

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
| Ledger validator | `node scripts/retro-action-ledger.mjs validate` checks every ledger line. | Exists. The consolidator and the report builder reject an invalid ledger, and no CI job calls it. |
| Validator CLI | `node scripts/validate-retro-inbox.mjs` checks shape, registries, ids, paths, and duplicate ids. | Exists. Runs only by hand, and no gate calls it. |
| CI job | A `.github/workflows/governance.yml` job runs the validator on every PR that touches `.context/retros/inbox/`. | PLANNED |
| Pre-commit gate | `setup-git-hooks.ps1` adds an inbox check for staged entries to the generated `.git/hooks/pre-commit.ps1`. | PLANNED |
| Retro full audit | `.github/workflows/retro-full-audit.yml` validates the inbox next to the retro history. | PLANNED |

## Changes

Changes to this policy, or to the registries in the retro inbox spec, need Tier 1 approval.

| Date | Change | Approval |
|---|---|---|
| 2026-10-18 | Initial policy. | Tier 1 |
| 2026-10-19 | Add the action ledger and the rule that an `approved` event authorizes a P0 or P1 action. | Tier 1, typed "APPROVE 4" in the session conversation |

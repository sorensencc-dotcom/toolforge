# Retro inbox spec

Schema: `retro-inbox/1`
Status: draft, governed by the [retro policy](../../docs/meta/governance/retro-policy.md), which awaits Tier 1 approval
Schema file: [retro-inbox-v1.schema.json](../../docs/meta/governance/schemas/retro-inbox-v1.schema.json)
Validator: [validate-retro-inbox.mjs](../../scripts/validate-retro-inbox.mjs)

The retro inbox is the one place where agents record retro findings. Each finding carries a deterministic id, so tools can de-duplicate it and later turn it into a TODOS.md item and an ICF action. Harvesting, consolidation, the TODOS.md writer, and ICF ingestion do not exist yet.

## Location

Write one JSON file per agent session:

`.context/retros/inbox/<agent>/<YYYY-MM-DD>-<slug>.json`

- `<agent>` is a registered agent and equals the entry's `agent`.
- `<YYYY-MM-DD>` equals the entry's `date`.
- `<slug>` is lowercase kebab-case, such as `retro-gate-scans-inbox`.
- The inbox holds entry files only. Agent directories have no subdirectories.

## Entry format

```json
{
  "schema": "retro-inbox/1",
  "agent": "claude",
  "repo": "toolforge",
  "date": "2026-10-17",
  "session": "feat/retro-governance",
  "findings": [
    {
      "id": "RF-707f88a76982",
      "tag": "GATE",
      "severity": "high",
      "summary": "retro-schema CI job validates inbox entries as v1.0 retros",
      "evidence": [
        ".context/retros/validate-changed.ps1:15 diffs the pathspec .context/retros/*.json, which also matches .context/retros/inbox/<agent>/<file>.json",
        ".context/retros/validate-v1.0.ps1:49 requires date, window, since, until, base_branch, metrics, authors, and session_focus"
      ],
      "suggestion": "Exclude .context/retros/inbox/ in validate-changed.ps1 before any agent commits an inbox entry."
    }
  ]
}
```

| Field | Type | Required | Rule |
|---|---|---|---|
| `schema` | string | yes | Exactly `retro-inbox/1`. |
| `agent` | string | yes | A registered agent. |
| `repo` | string | yes | The repository the findings concern, named as on GitHub without the owner, such as `toolforge`. |
| `date` | string | yes | The session date as a real `YYYY-MM-DD` calendar date. |
| `session` | string | no | A session reference, such as a branch or transcript id. |
| `findings` | array | yes | One or more findings. |

| Finding field | Type | Required | Rule |
|---|---|---|---|
| `id` | string | yes | `RF-` and 12 lowercase hex characters, computed as the next section describes. |
| `tag` | string | yes | A registered tag. |
| `severity` | string | yes | A registered severity. |
| `summary` | string | yes | One non-blank line of at most 200 characters. It becomes the TODOS.md title. |
| `evidence` | string array | yes | At least one non-blank item, such as `file:line`, a commit, a run id, a URL, or quoted output. |
| `suggestion` | string | no | The proposed fix. Its presence means the finding must become an action. |

Both objects reject unknown fields.

## Finding id

Compute the id from the finding, never by hand.

1. Normalize `repo`, `tag`, and `summary`. Trim each value, collapse every whitespace run to one space, and lowercase it.
2. Join the three values with a line feed.
3. Hash the UTF-8 bytes with SHA-256.
4. Prefix the first 12 hex characters with `RF-`.

For `toolforge`, `MCP`, and `graft MCP server times out on cold start`, the id is `RF-67037cac182c`. To check it by hand, run `printf 'toolforge\nmcp\ngraft mcp server times out on cold start' | sha256sum`.

- Whitespace and case changes keep the id. Any other change to `repo`, `tag`, or `summary` creates a new id.
- The id ignores `agent` and `date`. When two agents file the same finding, both copies get one id, and the validator rejects the second copy.
- The validator reports the expected id when an entry carries a wrong one.

## Registries

`INBOX_REGISTRY` in the validator holds every table below. Tools read the registry instead of restating these rules.

### Agents

| Agent | Writer |
|---|---|
| `claude` | Claude |
| `codex` | Codex |
| `grok` | Grok |
| `gemini` | Gemini |
| `copilot` | Copilot |
| `antigravity` | Antigravity |
| `human` | A person writing by hand |
| `ci` | A CI job |

### Tags

| Tag | Use for | ICF category |
|---|---|---|
| `INGESTION` | Ingestion pipelines, such as cic-ingestion, kb-sync, and TRM | `reliability` |
| `MCP` | MCP servers, tool schemas, and client connections | `reliability` |
| `GATE` | Pre-commit gates, approval gates, and conformance checks | `governance` |
| `CI` | GitHub Actions workflows and CI runs | `quality` |
| `DRIFT` | Docs, config, or state that disagrees with its source of truth | `governance` |
| `SPEC` | Missing, wrong, or ambiguous specs, plans, and contracts | `governance` |
| `TEST` | Test coverage, flaky tests, and test harnesses | `quality` |
| `PROCESS` | Workflow, handoff, and session discipline | `governance` |
| `TOOLING` | Scripts, CLIs, hooks, and developer tools | `delivery` |
| `SECURITY` | Secrets, permissions, sandboxing, and injection risks | `governance` |

The ICF category is one of the four `LAUNCH_CATEGORY_IDS` in `icf/reporting/src/category-contract.mjs`.

### Severities

| Severity | Use for | TODOS.md priority | TODOS.md append |
|---|---|---|---|
| `critical` | Data loss, a security exposure, or a blocked main branch | `P0` | After Tier 1 approval |
| `high` | A real gap that breaks a workflow or gate now | `P1` | After Tier 1 approval |
| `medium` | A defect with a workaround | `P2` | Automatic |
| `low` | Minor friction or a cosmetic issue | `P2` | Automatic |

## From finding to action

No tool performs this mapping yet. It fixes the contract for the planned consolidator, TODOS.md writer, and ICF ingestion.

- Only a finding with `suggestion` becomes an action. One finding id yields at most one action, and the action reuses that id.
- The TODOS.md item uses the existing item format, takes its priority from the severity table, and ends with a `<!-- retro-finding: RF-... -->` marker.
- The ICF action uses the identity below, which matches the key of `action_records` in `icf/reporting/src/snapshot-store.mjs`.

| ICF field | Value |
|---|---|
| `sourceSystem` | `retro-inbox` |
| `sourceId` | The finding id |
| `weekKey` | The ISO week of the entry `date`, such as `2026-W42` for `2026-10-17` |
| `categoryId` | The tag's ICF category |
| `wording` | The `suggestion` |
| `displayLabel` | The `summary` |
| `provenanceLinks` | The entry path, such as `.context/retros/inbox/claude/2026-10-17-retro-gate-scans-inbox.json` |

## Validation

Run `node scripts/validate-retro-inbox.mjs [inbox-dir]` from the repository root. The default directory is `.context/retros/inbox`. The command exits 0 when the inbox is valid, 1 when any rule fails, and 2 on a usage error. It checks these rules:

- Every file matches the schema, and every enum value is registered.
- Every `id` equals the computed id.
- Every file sits at `.context/retros/inbox/<agent>/<YYYY-MM-DD>-<slug>.json`.
- The agent directory equals `agent`, and the file-name date equals `date`.
- No finding id appears twice in the inbox.

To change a registry, edit `INBOX_REGISTRY`, run `node scripts/validate-retro-inbox.mjs --write-schema`, and record the change below. `tests/validate-retro-inbox.test.mjs` fails while the committed schema differs from the registry.

The schema file lives in `docs/meta/governance/schemas/` because `.context/retros/validate-v1.0.ps1` treats every other top-level JSON file in `.context/retros/` as a v1.0 retro and fails it.

## Change log

### retro-inbox/1 (2026-10-17)

- Initial draft.

# ADR process design

**Date:** 2026-10-01
**Status:** Draft, pending Tier 1 review
**Location:** `C:\dev\docs\meta\governance\` (policy, template, `adr/`), `C:\dev\scripts\` (tooling)

---

## Purpose

Give binding architecture decisions one recorded, Tier 1-signed channel, and gate promotion into `docs/Ecosystem Architecture Guide (Current).md` on verified evidence. The template already exists at `docs/meta/governance/adr-template.md`; this spec defines the policy around it and the minimum tooling to keep it consistent when several agents draft in parallel.

## Decisions taken during design

| # | Question | Decision |
| --- | --- | --- |
| 1 | Relationship to CIC amendments | Separate. `CIC-GOVERNANCE/AMENDMENTS/` keeps CIC gate-spec changes; ADRs cover everything else in scope. |
| 2 | Relationship to memory `decision-*.md` files | Two tiers. Memory notes stay as working notes; a decision that meets a trigger binds only once an ADR exists. No backfill. |
| 3 | Location | Hybrid. Cross-repo and guide-touching ADRs live centrally; a repo may keep its own `docs/adr/` for repo-internal decisions, outside this policy. |
| 4 | Trigger | Four-item list plus a Tier 1 flag. |
| 5 | Tooling scope | Policy, index, scaffold script, and lint script. Lint runs manually. KB ingestion deferred. |
| 6 | Numbering | Drafts are unnumbered (`draft-<slug>.md`); the number is assigned on promotion after a typed Tier 1 decision. |

---

## Section 1: policy and lifecycle

### Scope

A central ADR is required when a change does any of the following:

1. Edits architecture content in the Ecosystem Guide.
2. Changes a cross-repo contract: an API, schema, MCP tool surface, or file format that another repo consumes.
3. Adds or removes a domain node or service.
4. Reverses an earlier ADR or an earlier Tier 1 decision.

Tier 1 may also flag any other decision as "needs ADR" during review. Agents may not widen the trigger list themselves.

Out of scope for central ADRs:

- CIC gate-spec changes: use `CIC-GOVERNANCE/AMENDMENTS/`.
- Repo-internal decisions: optionally use the repo's own `docs/adr/` with the same template. The central policy, numbering, and lint do not govern those directories.

### Relationship to memory notes

Memory `decision-*.md` files remain lightweight working notes. When a decision meets a trigger, it does not bind other work until an ADR exists. The memory note links to the draft path (`adr/draft-<slug>.md`) until promotion, then to the ADR ID. Existing decision files and Tier 1 decisions recorded in `AGENTS.md` stay as they are.

### File layout

```
docs/meta/governance/
  adr-policy.md          # scope, triggers, lifecycle (this section, as policy)
  adr-template.md        # exists; filename instruction updated
  adr/
    README.md            # one-line purpose + index of numbered ADRs (ID, title, status, date proposed)
    draft-<slug>.md      # PROPOSED, unnumbered
    adr-NNNN-<slug>.md   # numbered on promotion
```

### Lifecycle

1. Any human or agent drafts with `node scripts/new-adr.mjs <slug>`. Status: `PROPOSED`, ID: `draft`.
2. Tier 1 types a decision in the conversation transcript. Only then does the executor run `--promote`:
   - `--to VERIFYING` assigns the next number and approves building and verifying a prototype.
   - `--to REJECTED` also assigns a number, so rejected proposals stay in the record.
3. The executor runs the template's section 5 checks and fills the Harness, Tests, and Shell coverage evidence rows.
4. Tier 1 types acceptance. The executor sets `ACCEPTED` and fills the Tier 1 decision line.
5. If the decision changes the guide, the executor promotes the content, runs `node scripts/sync-ecosystem-guide.mjs`, fills the Guide sync row, and sets `Promoted to guide: YES`. Otherwise the Guide sync row is `N/A` and `Promoted to guide: NO`.
6. Status moves forward only. To revise an `ACCEPTED` ADR, write a new ADR that supersedes it; set the old one to `SUPERSEDED` with a back-link.

Agents never promote without a typed Tier 1 decision. The lint checks that approver name and date are filled; it cannot prove a human approved. The existing transcript-approval rule in `CLAUDE.md` enforces that, not tooling.

---

## Section 2: tooling

All scripts are ESM `.mjs` files in `C:\dev\scripts\`, matching the existing `scripts/*.mjs` plus sibling `*.test.mjs` pattern.

### `scripts/new-adr.mjs`

**Draft mode:** `node scripts/new-adr.mjs <slug> [--title "..."]`

1. Validates that `<slug>` is kebab-case.
2. Refuses if `adr/draft-<slug>.md` or any `adr/adr-NNNN-<slug>.md` already exists.
3. Copies `adr-template.md` to `adr/draft-<slug>.md`, keeping only the content from `## ADR metadata` onward plus a title heading.
4. Fills `Date proposed` with today's date, `Title`, `Status: PROPOSED`, and `ID: draft`.

**Promote mode:** `node scripts/new-adr.mjs --promote <slug> --to VERIFYING|REJECTED --approver "<name>" [--reason "<text>"] [--dry-run]`

1. Refuses unless `adr/draft-<slug>.md` exists.
2. Refuses `--to REJECTED` without `--reason`.
3. Runs `git fetch origin`, and refuses if the fetch fails. Computes the next number as 1 plus the highest `adr-NNNN` found in either the working tree or `origin/main:docs/meta/governance/adr/`. Gaps are never reused. A promotion on a stale branch therefore cannot reuse a number already merged to main; two promotions racing between fetch and merge remain possible, and lint rule 2 catches them after merge.
4. Renames with `git mv` to `adr-NNNN-<slug>.md`, preserving history.
5. Rewrites metadata: `ID` to `ADR-NNNN`, `Status` to the target, and `Approver (Tier 1)` to the `--approver` value.
6. For `--to REJECTED` only, also fills the section 6 Tier 1 decision line (`REJECTED — <approver>, <today>`) and the decision rationale (`--reason`). For `--to VERIFYING`, section 6 stays untouched.
7. Appends a row to the index table in `adr/README.md`.
8. With `--dry-run`, prints the planned rename and edits and writes nothing, per the migration dry-run rule in `script-authoring-conventions.md`.

Later status moves (`ACCEPTED`, `SUPERSEDED`) are manual edits to both the ADR file and its index row; the lint validates both.

### `scripts/lint-adr.mjs`

`node scripts/lint-adr.mjs [path...] [--since <ref>]` checks all of `adr/` by default and exits non-zero on any error.

Rules:

1. Filenames match `draft-<slug>.md` or `adr-NNNN-<slug>.md`; `README.md` is exempt.
2. ADR numbers are unique, and each filename number matches the `ID` line.
3. Metadata fields are present and valid. "Filled" means non-empty and not a `<...>` template placeholder. Values may be wrapped in backticks.

   | Field | Draft | Numbered |
   | --- | --- | --- |
   | `ID` | `draft` | `ADR-NNNN`, matching the filename |
   | `Title` | filled | filled |
   | `Status` | `PROPOSED` | one of `VERIFYING`, `ACCEPTED`, `REJECTED`, `SUPERSEDED` |
   | `Date proposed` | `YYYY-MM-DD` | `YYYY-MM-DD` |
   | `Target domains` | present | filled |
   | `Repositories affected` | present | filled |
   | `Approver (Tier 1)` | present | filled |
   | `Executor (Tier 2)` | present | filled |
   | `Supersedes` | literal `none` or `ADR-NNNN` | literal `none` or `ADR-NNNN` |
   | `Superseded by` | literal `none` | literal `none`, or `ADR-NNNN` when `SUPERSEDED` |

4. Drafts have status `PROPOSED`; numbered files do not.
5. `ACCEPTED` and `SUPERSEDED` require a filled Tier 1 decision line (`ACCEPTED — <name>, YYYY-MM-DD`) and filled Harness, Tests, and Shell coverage evidence rows. A filled row has a commit SHA, a command, and exit code `0`.
6. Shell coverage and Guide sync rows may instead use the N/A form: `—` in the SHA and exit code columns, and `N/A — <reason>` with a non-empty reason in the command column. Harness and Tests rows may not be N/A.
7. `Promoted to guide: YES` requires a filled Guide sync row (not N/A) and a commit SHA in the promotion line. `Promoted to guide: NO` requires the Guide sync row to be N/A or empty. This check runs independently of rule 5, because guide promotion happens after acceptance.
8. `REJECTED` requires a filled Tier 1 decision line (`REJECTED — <name>, YYYY-MM-DD`) and a filled decision rationale. Evidence rows are not checked.
9. `SUPERSEDED` requires a `Superseded by` ID that exists, and that ADR's `Supersedes` field points back.
10. The `adr/README.md` index lists numbered ADRs only, and matches them exactly: same set of IDs, titles, statuses, and dates proposed. Drafts never appear in the index.
11. With `--since <ref>`, the lint checks each status transition between `<ref>` and the working tree. For each numbered file `adr-NNNN-<slug>.md`, it resolves the prior status in this order:
   1. `adr-NNNN-<slug>.md` exists at `<ref>`: use its status.
   2. Otherwise, `draft-<slug>.md` exists at `<ref>`: the file was promoted in this range; use the draft's status (`PROPOSED`).
   3. Otherwise: the file has no prior state (drafted and promoted within the range), so no transition check applies. Rules 1 to 10 still apply.

   An unchanged status passes. Allowed changes: `PROPOSED` to `VERIFYING` or `REJECTED`; `VERIFYING` to `ACCEPTED` or `REJECTED` (verification failed); `ACCEPTED` to `SUPERSEDED`. `REJECTED` and `SUPERSEDED` are terminal. Any other change fails.

   A numbered file that exists at `<ref>` but not in the working tree also fails: numbered ADRs are never renamed or deleted. Drafts may disappear (promoted or abandoned) without error.

The future enforcement work (separate topic) can call `node scripts/lint-adr.mjs --since origin/main` from a hook or CI job.

### `scripts/lib/adr-parse.mjs`

A new shared module (the `scripts/lib/` directory does not exist yet) used by both scripts:

- `parseMetadata(text)` reads `- **Field:** value` lines from the `## ADR metadata` section.
- `parseEvidence(text)` reads the section 6 evidence table into rows, each classified as filled, N/A, or empty.
- `parseDecision(text)` reads the Tier 1 decision line, the decision rationale, and the promotion line.

Both line endings (CRLF and LF) are accepted. Three template formats become parser contracts: the `- **Field:** value` metadata lines, the evidence table columns, and the section 6 decision, rationale, and promotion lines. Changing any of them in `adr-template.md` requires a matching parser change; the template marks them as such.

---

## Section 3: testing and rollout

### Tests

`scripts/new-adr.test.mjs` and `scripts/lint-adr.test.mjs` use `node --test` and never touch the real `adr/`. Promotion uses `git mv` and `git fetch`, so scaffold tests run in a temporary git repo with a temporary bare repo as `origin`. Lint tests use plain temporary directories, except `--since` cases.

**Scaffold:**

- Draft creation produces the expected file and fields.
- Duplicate slug and invalid slug are refused.
- Promotion with `adr-0001` and `adr-0003` present assigns `0004`.
- Promotion on a stale branch, with `adr-0005` on `origin/main` but not local, assigns `0006`.
- Promotion refuses when `git fetch` fails.
- `--to VERIFYING` sets `Approver (Tier 1)` and leaves section 6 untouched.
- `--to REJECTED` fills the decision line and rationale; without `--reason` it is refused.
- Promoting an already-numbered file is refused.
- `--dry-run` writes nothing.
- Promotion appends the index row.

**Lint:** one passing and one failing fixture per rule, including:

- Duplicate numbers.
- Numbered file with a placeholder `Approver (Tier 1)`.
- `ACCEPTED` with an empty Harness row.
- Evidence row with a non-zero exit code.
- `ACCEPTED` with Shell coverage as `N/A — <reason>` passes; with an empty reason fails; Tests as N/A fails.
- `ACCEPTED`, `Promoted to guide: NO`, Guide sync N/A passes (the ADR-0001 shape).
- `Promoted to guide: YES` with Guide sync N/A fails.
- `REJECTED` without rationale fails.
- One-way superseded link.
- Index out of sync with numbered files; a draft present with no index row passes.
- `--since` cases, using a temporary git repo:
  - an `ACCEPTED` to `PROPOSED` regression fails;
  - a draft at `<ref>` promoted to `adr-NNNN` in the range passes (rename-aware lookup);
  - a file drafted and promoted within the range passes with no transition check;
  - a numbered file deleted since `<ref>` fails.

**Parser:** identical results for CRLF and LF input.

Run under a hard timeout, per the Command & Test Execution Protocol in `AGENTS.md`:

- Git Bash: `timeout 60 node --test scripts/new-adr.test.mjs scripts/lint-adr.test.mjs`
- PowerShell: `bash -c "timeout 60 node --test scripts/new-adr.test.mjs scripts/lint-adr.test.mjs"`. PowerShell's own `timeout` is a different command (a console pause) and gives no hard timeout, so route through Git Bash's GNU `timeout`.

Add an npm script `test:adr` running `node --test scripts/new-adr.test.mjs scripts/lint-adr.test.mjs` with no timeout inside it: npm runs scripts through `cmd.exe` on Windows, where `timeout` is also the console pause. Callers wrap it, matching the `timeout 60 npm test` form in `AGENTS.md`: `timeout 60 npm run test:adr` from Git Bash. Do not add it to the main `test` script, which globs `src/` only.

### Rollout

1. Write `docs/meta/governance/adr-policy.md` from section 1.
2. Create `docs/meta/governance/adr/README.md` with a one-line purpose and an empty index table, per the subfolder README rule in `documentation-policy.md`.
3. Commit `adr-template.md` with the draft-and-promote instructions, the N/A row form, and the parser-contract notes. These edits land with this spec, ahead of the scripts, so the template never contradicts decision 6.
4. List `adr-policy.md` and `adr/` in `docs/meta/governance/README.md`.
5. Add one pointer line to `AGENTS.md`, outside the IJFW-managed regions: binding decisions need an ADR; see `docs/meta/governance/adr-policy.md`.
6. Dogfood the process: draft ADR-0001 for this policy, promote it after Tier 1 review, and fill its evidence rows from the test run. ADR-0001 matches none of the four triggers, so it exists only through an explicit Tier 1 flag at spec review. If Tier 1 does not flag it, skip this step: central ADRs exist only through a trigger or a flag, never as optional records. ADR-0001 has no guide change, so its Guide sync row is N/A and `Promoted to guide: NO`.

### Out of scope

- Hook or CI enforcement of the guide gate (separate topic).
- KB ingestion of ADRs into kb-sync and Obsidian.
- Backfilling memory decision files or `AGENTS.md` Tier 1 decisions.
- Per-repo `docs/adr/` directories.

### Known risk

The lint only protects the process when someone runs it. Until hook or CI enforcement lands, the guide gate depends on agents and Tier 1 running `lint-adr.mjs` manually before promotion.

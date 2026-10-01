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

Memory `decision-*.md` files remain lightweight working notes. When a decision meets a trigger, it does not bind other work until an ADR exists, and the memory note links to the ADR by ID. Existing decision files and Tier 1 decisions recorded in `AGENTS.md` stay as they are.

### File layout

```
docs/meta/governance/
  adr-policy.md          # scope, triggers, lifecycle (this section, as policy)
  adr-template.md        # exists; filename instruction updated
  adr/
    README.md            # one-line purpose + index table (ID, title, status, date)
    draft-<slug>.md      # PROPOSED, unnumbered
    adr-NNNN-<slug>.md   # numbered on promotion
```

### Lifecycle

1. Any human or agent drafts with `node scripts/new-adr.mjs <slug>`. Status: `PROPOSED`, ID: `draft`.
2. Tier 1 types a decision in the conversation transcript. Only then does the executor run `--promote`:
   - `--to VERIFYING` assigns the next number and approves building and verifying a prototype.
   - `--to REJECTED` also assigns a number, so rejected proposals stay in the record.
3. The executor runs the template's section 5 checks and fills the section 6 evidence table.
4. Tier 1 types acceptance. The executor sets `ACCEPTED`, promotes the content to the guide, and runs `node scripts/sync-ecosystem-guide.mjs`.
5. Status moves forward only. To revise an `ACCEPTED` ADR, write a new ADR that supersedes it; set the old one to `SUPERSEDED` with a back-link.

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

**Promote mode:** `node scripts/new-adr.mjs --promote <slug> --to VERIFYING|REJECTED --approver "<name>" [--dry-run]`

1. Refuses unless `adr/draft-<slug>.md` exists.
2. Computes the next number as the highest existing `adr-NNNN` plus 1. Gaps are never reused.
3. Renames with `git mv` to `adr-NNNN-<slug>.md`, preserving history.
4. Rewrites the `ID` and `Status` lines, and records the approver and date.
5. Appends a row to the index table in `adr/README.md`.
6. With `--dry-run`, prints the planned rename and edits and writes nothing, per the migration dry-run rule in `script-authoring-conventions.md`.

Later status moves (`ACCEPTED`, `SUPERSEDED`) are manual edits validated by the lint.

### `scripts/lint-adr.mjs`

`node scripts/lint-adr.mjs [path...] [--since <ref>]` checks all of `adr/` by default and exits non-zero on any error.

Rules:

1. Filenames match `draft-<slug>.md` or `adr-NNNN-<slug>.md`; `README.md` is exempt.
2. ADR numbers are unique, and each filename number matches the `ID` line.
3. Required metadata fields are present, and `Status` is one of `PROPOSED`, `VERIFYING`, `ACCEPTED`, `REJECTED`, or `SUPERSEDED`.
4. Drafts have status `PROPOSED`; numbered files do not.
5. `ACCEPTED` requires a filled Tier 1 decision line (approver and date) and every evidence row filled with a commit SHA, a command, and exit code `0`.
6. `SUPERSEDED` requires a `Superseded by` ID that exists, and that ADR's `Supersedes` field points back.
7. The `adr/README.md` index matches the files: same set of IDs, titles, and statuses.
8. With `--since <ref>`, each numbered file's status is compared with `git show <ref>:<file>`; any move not in the allowed set fails. Allowed moves: `PROPOSED` to `VERIFYING` or `REJECTED`; `VERIFYING` to `ACCEPTED` or `REJECTED` (verification failed); `ACCEPTED` to `SUPERSEDED`. `REJECTED` and `SUPERSEDED` are terminal.

The future enforcement work (separate topic) can call `node scripts/lint-adr.mjs --since origin/main` from a hook or CI job.

### `scripts/lib/adr-parse.mjs`

A new shared module (the `scripts/lib/` directory does not exist yet) used by both scripts:

- `parseMetadata(text)` reads `- **Field:** value` lines from the `## ADR metadata` section.
- `parseEvidence(text)` reads the section 6 evidence table into rows.
- `parseDecision(text)` reads the Tier 1 decision line.

Both line endings (CRLF and LF) are accepted. The template's metadata line format becomes a contract: changing `- **Field:** value` in `adr-template.md` requires a matching parser change.

---

## Section 3: testing and rollout

### Tests

`scripts/new-adr.test.mjs` and `scripts/lint-adr.test.mjs` use `node --test` and run against temporary directories, never the real `adr/`.

**Scaffold:**

- Draft creation produces the expected file and fields.
- Duplicate slug and invalid slug are refused.
- Promotion with `adr-0001` and `adr-0003` present assigns `0004`.
- Promoting an already-numbered file is refused.
- `--dry-run` writes nothing.
- Promotion appends the index row.

**Lint:** one passing and one failing fixture per rule, including:

- Duplicate numbers.
- `ACCEPTED` with an empty evidence row.
- Evidence row with a non-zero exit code.
- One-way superseded link.
- Index out of sync with files.
- `--since` catching an `ACCEPTED` to `PROPOSED` regression, using a temporary git repo.

**Parser:** identical results for CRLF and LF input.

Run: `timeout 60 node --test scripts/new-adr.test.mjs scripts/lint-adr.test.mjs`. Add an npm script `test:adr`. Do not add it to the main `test` script, which globs `src/` only.

### Rollout

1. Write `docs/meta/governance/adr-policy.md` from section 1.
2. Create `docs/meta/governance/adr/README.md` with a one-line purpose and an empty index table, per the subfolder README rule in `documentation-policy.md`.
3. Update the filename instruction in `adr-template.md` to "Run `node scripts/new-adr.mjs <slug>`".
4. List `adr-policy.md` and `adr/` in `docs/meta/governance/README.md`.
5. Add one pointer line to `AGENTS.md`, outside the IJFW-managed regions: binding decisions need an ADR; see `docs/meta/governance/adr-policy.md`.
6. Dogfood the process: draft ADR-0001 for this policy, promote it after Tier 1 review, and fill its evidence rows from the test run.

### Out of scope

- Hook or CI enforcement of the guide gate (separate topic).
- KB ingestion of ADRs into kb-sync and Obsidian.
- Backfilling memory decision files or `AGENTS.md` Tier 1 decisions.
- Per-repo `docs/adr/` directories.

### Known risk

The lint only protects the process when someone runs it. Until hook or CI enforcement lands, the guide gate depends on agents and Tier 1 running `lint-adr.mjs` manually before promotion.

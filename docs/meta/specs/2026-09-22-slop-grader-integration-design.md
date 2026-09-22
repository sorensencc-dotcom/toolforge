# slop-grader integration design

- **Status**: Approved (chat design review, sectioned approval 2026-09-22)
- **Owner**: Chris Sorensen
- **Date**: 2026-09-22

## Context

AGENTS.md already mandates a 12-point Technical Writing Heuristics & Style
Discipline policy, enforced today by `skills/writing-heuristics/` — a
deterministic, regex-based CLI (`bin/lint-heuristics.js`) covering 10 rules:
throat-clearing, filler adverbs, first-person plural, second-person mood,
active voice, metric grounding, condition-before-action, heading sentence
case, descriptive links, and Oxford comma. It ships autofix support and a
suppression syntax with audit trail.

[slop-grader](https://github.com/lukstei/slop-grader) is a rule-based,
LLM-graded prose grader (OpenRouter-only backend, no self-host path) with
five built-in rulesets: `article-scores`, `grammar-english`,
`grammar-german`, `no-ai-slop`, `tech-docs`.

### Ruleset comparison

Two of slop-grader's rulesets were compared line-by-line against
writing-heuristics' 10 rules:

- **`no-ai-slop`** overlaps narrowly with writing-heuristics' filler-adverb
  rules (`banned_word`, `empty_adverb`, `empty_phrase`, `importance_puffery`
  vs. `ban-filler-adverbs`/`ban-throat-clearing`), but adds rhetorical/
  stylistic AI tells writing-heuristics cannot express as regex: em-dash
  overuse, formatting_slop, synonym_cycling, fake_profound_kicker,
  negative_listing, binary_contrast, rhetorical_setup, weasel_attribution,
  fake_strong_verb, dramatic_fragmentation, colon_reveal.
- **`tech-docs`** is orthogonal — document-level structural grading
  (`structure_navigability`, `completeness`, `code_example_quality`,
  `prerequisite_clarity`) plus line rules (`undefined_jargon`,
  `ambiguous_reference`, `missing_version_qualifier`, `magic_value`,
  `stale_placeholder`, `minimizing_complexity`) — none of which
  writing-heuristics covers.
- `grammar-english`, `grammar-german`, `article-scores` are out of scope
  (grammar correctness / blog-article scoring, not this repo's
  docs/wiki/specs sweep).

Conclusion: the two tools are complementary, not duplicative. Decision:
run both, on separate tiers, rather than building a custom ruleset from
scratch (writing-heuristics already is that custom ruleset) or folding
slop-grader into writing-heuristics' own CLI.

## Approaches considered

| # | Approach | Verdict |
|---|----------|---------|
| A | Standalone slop-grader install, thin wrapper scripts outside `skills/` | Fastest to ship, but inconsistent with this repo's skill-packaging convention (skill.json + src/ + tests/ + docs/) |
| B | Wrap as a proper repo skill, `skills/slop-grader-sweep/` | **Chosen.** Matches convention, keeps fast deterministic tier and slow LLM tier cleanly separated as two invocation paths inside one skill |
| C | Fold into `writing-heuristics`' own CLI as another check | Rejected — mixes fast regex linting with slow/costly LLM calls in one tool, breaks the pre-commit fast-path requirement, and conflicts with writing-heuristics' own frontmatter claim of being a "deterministic ... engine" |

## Design

### Architecture

New skill directory `skills/slop-grader-sweep/`, packaged per this repo's
Toolforge convention:

```
skill.json          # name, runtime=node, entrypoint, owner, category=docs-quality, status
SKILL.md             # frontmatter + trigger + I/O schema, <150 lines
README.md            # pitch + quickstart, <100 lines
src/
  run-slop-grader.mjs   # adapter: spawns slop-grader CLI, two modes
scripts/
  install-hook.mjs    # one-time, idempotent pre-commit hook installer
docs/
  USAGE.md            # workflow, troubleshooting, examples
tests/
  run-slop-grader.test.mjs
  install-hook.test.mjs
package.json           # pinned slop-grader dependency
package-lock.json
```

Two invocation paths inside one skill, not two separate tools:

- **`changed` mode** — git-diff staged `.md` files under `docs/`, `wiki/`,
  or `**/specs/`, graded against `no-ai-slop`+`tech-docs`, invoked from a
  pre-commit hook, warn-only, never blocks.
- **`sweep` mode** — full glob of the same three roots, invoked from a
  scheduled workflow, report-only, no gate.

slop-grader stays an external npm dependency (not vendored); the adapter
shells out to its CLI. Declared as a pinned exact-version `dependency`
(not `devDependency` — it runs in CI and in the pre-commit hook, both
outside a dev-only install) in `skills/slop-grader-sweep/package.json`,
with a committed `package-lock.json` for that directory. CI and the
hook installer both run `npm ci` before first use. Missing/uninstalled
binary is not a hard failure on either path — see Error handling.

### Components & credential wiring

- **`src/run-slop-grader.mjs`** — single entrypoint, `mode` arg
  (`changed` | `sweep`). Resolves the file list, builds slop-grader CLI
  args, spawns the subprocess, parses JSON output.
- **Credential adapter** — calls the canonical `resolveApiKey('openrouter')`
  from `C:\dev\credential-resolver.ts`, sets `OPENROUTER_API_KEY` for the
  slop-grader child process. No new key-loading path, no duplicated
  secrets.
- **Ruleset flag** — hardcoded `--ruleset no-ai-slop,tech-docs`. Not
  user-configurable in v1 (YAGNI); add a flag only if a real need
  surfaces.
- **File-list resolver**:
  - `changed` mode: `git diff --name-only --diff-filter=ACM --cached`,
    filtered to `*.md` under `docs/`, `wiki/`, or any `**/specs/**` path.
  - `sweep` mode: glob all `*.md` under the same three roots, repo-wide.
- **Pre-commit hook wiring** — `.git/hooks/` is untracked (confirmed:
  no `install-git-hooks.mjs` exists at repo root; `.git/hooks/pre-commit.ps1`
  itself carries an "Auto-generated ... Do not edit" header with no
  committed generator producing it). Editing it directly would not survive
  a fresh clone or reach CI. Fix: this skill ships a tracked installer,
  `skills/slop-grader-sweep/scripts/install-hook.mjs`, that appends the
  `run-slop-grader.mjs changed` call to the existing (or a newly
  scaffolded) `.git/hooks/pre-commit.ps1`, idempotently (checks for a
  marker comment before appending). Run once manually after `npm install`
  in this skill's directory; documented as a setup step in
  `docs/USAGE.md`. CI does not depend on this hook at all — CI coverage
  comes exclusively from the scheduled sweep workflow below. Warn-only:
  the appended step prints findings, always exits 0, and wraps the
  subprocess call in a hard 30-second timeout (kill + treat as
  unavailable on expiry) so a slow OpenRouter call cannot stall a commit.
- **Scheduled sweep wiring** — new GitHub Actions workflow
  `.github/workflows/slop-sweep.yml`:
  - `schedule:` cron (weekly, mirroring `retro-full-audit.yml`'s pattern).
  - `permissions: contents: write` (required to commit the report back).
  - `env: OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}` — new
    repo secret, provisioned once by the user outside this skill's scope;
    `resolveApiKey('openrouter')` reads it from the environment exactly
    as it does locally. Secret absent → same DEGRADED path as an API
    failure (see Error handling), not a workflow failure.
  - `concurrency: group: slop-sweep, cancel-in-progress: true` — prevents
    overlapping runs.
  - `paths-ignore: ['drift/SLOP-REPORT.md']` on the trigger — the report
    commit cannot re-trigger this same workflow.
  - Commits as `github-actions[bot]`; the commit step first runs
    `git diff --quiet -- drift/SLOP-REPORT.md` and skips the commit
    entirely on a no-op (no findings changed since last run).
  - Runs `run-slop-grader.mjs sweep`, writes `drift/SLOP-REPORT.md` (same
    location/format convention as the existing `drift/DRIFT-REPORT.md`).

### Data flow

**changed path (pre-commit):**
1. Hook fires on `git commit` → calls `run-slop-grader.mjs changed`.
2. Resolve staged `.md` files under `docs/|wiki/|**/specs/`. Empty list →
   exit 0 immediately, no subprocess spawned.
3. `resolveApiKey('openrouter')` → env var set.
4. Spawn
   `slop-grader check --ruleset no-ai-slop,tech-docs --format json <files>`
   under a 30-second timeout.
5. Parse JSON, print a human-readable warning summary (file:line, rule id,
   severity) to stdout.
6. Exit 0 always — commit proceeds regardless of findings or timeout.

**sweep path (scheduled):**
1. Workflow cron fires → `run-slop-grader.mjs sweep`.
2. Glob all `.md` under the three roots, repo-wide.
3. Same credential + slop-grader invocation, batched.
4. Aggregate JSON → render `drift/SLOP-REPORT.md` (heading, per-file
   findings grouped by rule, summary counts) — same shape as
   `drift/DRIFT-REPORT.md`.
5. `git diff --quiet -- drift/SLOP-REPORT.md`; skip the commit step on
   no-op, otherwise commit as `github-actions[bot]`.

### Error handling

- **OpenRouter API failure (rate-limit, auth, timeout) — changed path:**
  catch subprocess error or the 30-second timeout, print one-line warning
  (`slop-grader unavailable: <reason>, skipping`), exit 0.
- **OpenRouter API failure — sweep path:** retry once; on second failure,
  write `drift/SLOP-REPORT.md` with a `Status: DEGRADED` header (same
  convention as morning-ingestion's DEGRADED marking) rather than failing
  the workflow or leaving a stale report uncommitted.
- **slop-grader binary missing/not installed:** same treatment as API
  failure on both paths — never a hard failure; this tool is
  advisory-only.
- **Empty git diff (changed path):** not an error — exit 0 silently, no
  warning noise.
- **Credential missing (`resolveApiKey('openrouter')` throws, or
  `OPENROUTER_API_KEY` secret unset in the workflow):** same as
  API failure — warn/skip on changed path, DEGRADED on sweep path, never
  crash the hook or the workflow.
- **Pre-commit call exceeds 30 seconds:** kill the subprocess, treat as
  unavailable (same warn/skip path as an API failure) — a slow LLM call
  never blocks the commit beyond that bound.

### Testing

- **`tests/run-slop-grader.test.mjs`** — subprocess call to the real
  `slop-grader` CLI and to `resolveApiKey` are mocked/stubbed. No live
  OpenRouter calls in CI.
- Cases covered:
  1. `changed` mode, empty staged-file list → exits 0, no subprocess
     spawned.
  2. `changed` mode, matching `.md` files → asserts correct CLI args
     (`--ruleset no-ai-slop,tech-docs --format json`, correct file paths).
  3. `sweep` mode → asserts glob resolves all three roots.
  4. Subprocess failure (mocked reject) → asserts exit 0 + warning
     (changed path), DEGRADED report (sweep path).
  5. Credential resolution failure → same DEGRADED/warn assertions.
  6. Changed-path subprocess exceeding the 30-second timeout → asserts
     kill + warn/skip + exit 0.
  7. Sweep-path no-op (report content unchanged) → asserts commit step
     skipped.
- `install-hook.mjs` gets its own smoke test: run twice against a scratch
  `pre-commit.ps1` fixture, assert the appended block appears once
  (idempotency), not twice.
- `npm test` inside `skills/slop-grader-sweep/`, wired into the skill's
  own `package.json` `test` script.
- No E2E test against the real slop-grader binary + live API — out of
  automated scope; a manual smoke test (documented in `docs/USAGE.md`)
  covers that once, at build time.

## Open questions / deferred

None outstanding. All four brainstorming clarifying questions resolved:
jev = context only (not an integration target), scope = broad sweep of
`docs/`, `wiki/`, specs, trigger = pre-commit fast-path (warn-only) +
scheduled full-repo sweep (report-only), ruleset source = both
writing-heuristics (existing, unchanged) and slop-grader's `no-ai-slop` +
`tech-docs` rulesets (new, this skill), run as separate tiers rather than
merged into one tool.

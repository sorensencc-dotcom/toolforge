# TRM-to-Treatment Sync Skill — Design

Status: DRAFT — pending user review
Opened from: `TODOS.md` "TRM-scan-to-treatment sync skill" item, sourced from
`memory/session-wrap-2026-07-28-benson-ford-close.md`.

## Problem

TRM ingest produces per-topic `extract.json` fact files under
`trm-vault/topics/charlie/<topic>/extracts/extract.json`. Reconciling new
facts into the CIC documentary treatment (a separate repo,
`charlie-deep-research/`, keyed by V-item beat IDs) is currently manual and
ad-hoc: someone reads the extract file, cross-references
`CIC_SOURCE_LIBRARY.md` and `CIC_SOURCING_DEPENDENCY_MAP_v1.json` by hand,
and updates the source library / treatment draft themselves. This doesn't
scale past a handful of topics and has no repeatable diff mechanism (no way
to know what's already been reconciled vs. new since last pass).

## Scope

Build a `trm sync-treatment` CLI subcommand that:

1. Diffs each topic's `extract.json` against a per-topic cursor to find
   facts not yet surfaced.
2. Suggests candidate V-item/beat matches via deterministic keyword/category
   scoring (no LLM call).
3. Writes a markdown reconciliation report into `charlie-deep-research/treatment/`.
4. Updates the cursor only after a successful report write.

**Out of scope (explicit non-goals for v1):**

- No automatic editing of treatment prose or `CIC_SOURCE_LIBRARY.md`. Human
  reviews the report and integrates by hand — this is a Tier 1 narrative
  decision, not a Tier 3 automation.
- No LLM-assisted matching. Deterministic scoring only, so runs are
  reproducible and unit-testable.
- No `--since <date>` partial-sync flag — cursor-based diffing already
  covers the "what's new" case; a date flag is redundant until a concrete
  need appears.
- No auto-trigger after `trm ingest-dir`. Manual invocation only.

## Architecture

New command file `C:\dev\trm\src\cli\commands\syncTreatment.ts`, registered
in `src/cli/index.ts` alongside the existing per-command pattern (`validate.ts`,
`report.ts`, etc.). Reads from `trm-vault` (owned by trm), writes only to
`charlie-deep-research/treatment/` (owned by the narrative repo) — no writes
back into trm-vault except the cursor file, which is sync-run bookkeeping,
not vault content.

The two repos stay decoupled: trm owns the vault/extract schema, the
narrative repo owns beat structure and prose. The sync command is the only
bridge, and it only ever produces a new report file — never mutates existing
narrative-repo files.

**Path contract (no hardcoded/CWD-relative paths):** the command takes
explicit roots — `--vault-root <path>` (default: `trm-vault` resolved from
trm's existing config, same resolution `validate`/`ingest-dir` already use),
`--narrative-root <path>` (default: sibling `charlie-deep-research/` next to
the vault root — overridable, no assumption baked in), `--dependency-map
<path>` (default: `<narrative-root>/treatment/CIC_SOURCING_DEPENDENCY_MAP_v1.json`).
All three are validated to exist and be directories/files respectively
before any processing starts. The report output path is resolved with
`fs.realpathSync` and checked to be a descendant of
`<narrative-root>/treatment` — if resolution escapes that directory (symlink
or `..` traversal), the command hard-errors rather than writing anywhere.

**Concurrency:** a lockfile at `<vault-root>/.sync-treatment.lock` (pid +
timestamp) is created exclusively (`wx` flag) at the start of a run and
removed at the end. A second invocation while the lock exists fails fast
with a distinct error rather than racing the first run's cursor writes. A
stale lock (process no longer running, checked via pid liveness) is
reclaimed with a warning.

## Fact identity

`extract.json`'s `FCT-###` ids are **not stable** — confirmed in
`trm/src/core/regenerateExtractJson.ts:32-35`, every regen renumbers facts
positionally from the merged array (`FCT-${i+1}`). A cursor keyed on `FCT-###`
would silently misattribute "already synced" across reruns whenever facts
are added, removed, or reordered upstream. `id` is display-only and must
never be used as a diff key.

Stable key instead: `factKey = sha256(source_id + "|" + normalize(text))`,
where `normalize` is the same lowercase/strip-punctuation/collapse-whitespace
function used for matching (one normalization function, shared). This is
computed fresh from `extract.json` content on every run — no dependency on
manifestStore internals. Two distinct facts from the same source with
byte-identical normalized text collide and dedupe as one; this is treated as
an accepted, documented edge case for v1 (not expected in practice — facts
are extracted narrative statements, not short tags), not a bug to solve now.

Fact identity handles the real cases:

- **Edited fact** (same source_id, changed text) → new `factKey`, appears as
  "new" — correct, since the content genuinely changed and needs re-review.
- **Deleted fact** → its `factKey` simply stops appearing in `extract.json`;
  the cursor still lists it, which is harmless (cursor is a "seen" set, not
  a live inventory) but not actively reconciled — no "fact removed" report
  section in v1.
- **Reordered/renumbered facts** (the common case that broke `FCT-###`) →
  `factKey` is unaffected, since it doesn't depend on array position.

## Cursor state

One file per topic: `trm-vault/topics/charlie/<topic>/.sync-cursor.json`.

```json
{
  "cursorVersion": 1,
  "lastSyncedFactKeys": ["<sha256>", "<sha256>"],
  "lastRunAt": "2026-07-28T18:00:00.000Z",
  "factCountAtLastSuccessfulSync": 2
}
```

(`factCountAtLastSuccessfulSync` is diagnostic only — for spotting drift
between expected and actual fact counts across runs — never used in diff
logic.)

- Diff: read `extracts/extract.json`, compute `factKey` for every fact,
  compare against `lastSyncedFactKeys`. Anything not present is "new this run."
- **Atomic writes:** both the report file and each cursor file are written
  to a temp path in the same directory and moved into place with
  `fs.renameSync` (atomic on the same filesystem) — never a partial file
  visible to a concurrent reader or a crash mid-write. The report is created
  with exclusive-create semantics (`wx` flag on the temp file) so two runs
  can never silently overwrite each other's report.
- **Crash safety, stated precisely:** cursors update only after the report
  file's rename-into-place succeeds. There is no reliable way to log
  "which cursors got updated" if the process dies mid-way through the
  per-topic cursor-update loop after that point — accept this rather than
  claim false precision. The concrete consequence: if the process crashes
  after the report is written but before all touched cursors are updated,
  the next run may regenerate a **duplicate report** repeating some facts
  from the crashed run. This is safe (no data loss, no silent gap) and
  cheap (human just sees repeated facts in two reports) — not worth solving
  with a run-manifest for v1. The lockfile (see Architecture) prevents this
  from compounding via concurrent reruns.
- Malformed/unreadable cursor JSON → that topic's cursor is treated as empty
  (all its facts appear "new"), a warning is logged to stderr with the
  cursor file path, and the report includes a "cursor reset" note (see
  Report output) — scoped to that topic only, not the whole run.

## Matching

Load `CIC_SOURCING_DEPENDENCY_MAP_v1.json` once per run (array of
`{ id, beat, claim, ... }`). This file is not owned by the sync command and
the command never writes to it. As a one-time prerequisite (a separate,
manually-reviewed edit to the narrative repo, done before this feature
ships — not automated by the sync tool), the file gains a top-level
`matchSchemaVersion` field. The sync command requires this field to be
present and equal to a version it recognizes (`1` for v1); if the field is
missing or unrecognized, that is a hard error (exit code 1, message
identifies the file, the found value, and the supported versions) — the
command never assumes a default or silently proceeds against an
unversioned or newer-than-known schema.

Matching logic itself is versioned separately from the dependency-map
schema, via a `matchConfigVersion` constant owned by the sync command (not
the map file) — the map's shape and the scoring algorithm are independent
concerns and can each change without the other.

**Normalization** (shared by fact-identity hashing and matching — one
function, one place): lowercase, strip all non-alphanumeric characters,
collapse whitespace runs to a single space, trim. No stemming/lemmatization
in v1 (adds a dependency and nondeterminism risk across environments;
revisit only if plain-token matching proves too weak in practice).

**Scoring formula** (`matchConfigVersion: 1`), for a fact `f` against a
V-item `v`:

```text
categoryTokens(v)  = normalize(v.claim) tokens, stopword-filtered
factTokens(f)      = normalize(f.text) tokens, stopword-filtered
catScore           = |f.categories ∩ categoryTokens(v)| / max(1, |f.categories|)   // Jaccard-style, fact-categories-vs-claim-tokens
tokScore           = |factTokens(f) ∩ categoryTokens(v)| / |factTokens(f) ∪ categoryTokens(v)|   // Jaccard on token sets
score(f, v)        = round(0.5 * catScore + 0.5 * tokScore, 3)
```

Stopword list: a fixed, small, checked-in English stopword list (~100
common words) — same list used for both `categoryTokens` and `factTokens`.
Empty `f.categories` → `catScore = 0` for that fact (not skipped, not an
error). Duplicate tokens are deduplicated before set operations (Jaccard is
over sets, not multisets).

Bucket the score: `>= 0.6` → high, `>= 0.3` → medium, `>= 0.1` → low, `< 0.1`
→ no match (goes to "unmatched" bucket). Thresholds are inclusive at the
lower bound of each named bucket. These three constants plus the 0.5/0.5
weighting live together under `matchConfigVersion: 1` — changing any of
them is a version bump, not a silent tuning edit, so old reports remain
interpretable against the config version that produced them.

Cap suggested matches at 3 per fact (highest-scoring first; ties broken by
V-item `id` ascending, string comparison). Facts scoring below 0.1 against
every V-item go in the "unmatched" bucket.

Missing dependency-map file → hard error (exit code 1), error message
includes the expected file path. Matching cannot proceed without it, unlike
a missing per-topic `extract.json`, which is a per-topic skip.

## Topic discovery

For an `all`-topics run: enumerate direct subdirectories of
`<vault-root>/topics/charlie/`, excluding dotfile-prefixed entries and any
non-directory entries. A discovered directory counts as a topic candidate
regardless of whether it has an `extracts/extract.json` yet — a topic with
no extract file is a per-topic skip (see Error handling), not silently
excluded from discovery. An empty candidate set (no subdirectories at all)
is not an error: the run proceeds, produces a report stating
`No topics found.`, and exits `0`.

## Report output

One file per run, never overwritten. Filename embeds a `runId` (a short
random hex/UUID suffix, not just a timestamp) so same-second reruns cannot
collide even at second-level timestamp precision:
`charlie-deep-research/treatment/TRM_SYNC_REPORT_<topic>_<YYYYMMDDTHHMMSS>_<runId>.md`
(or `_all_` when run across all topics). A `--dry-run` invocation uses a
`_DRYRUN_` infix (`TRM_SYNC_REPORT_DRYRUN_<topic>_<timestamp>_<runId>.md`)
and sets `dryRun: true` in frontmatter — explicitly **not** side-effect-free
(it still writes this file; only the cursor update is skipped), and named
accordingly rather than called a "preview."

Frontmatter header:

```yaml
---
topic: <topic|all>
runId: <uuid>
runAt: <ISO timestamp>
vaultSnapshot: <ISO timestamp of extract.json read>
matchVersion: <matchSchemaVersion from dependency-map file>
matchConfigVersion: 1
cursorVersion: 1
partialRun: false
dryRun: false
topicsProcessed: ["willow-run", "cuba"]
topicsSkipped: []
---
```

`partialRun` is `true` if and only if `topicsSkipped` is non-empty — i.e.
at least one topic candidate (from Topic discovery) was skipped due to a
missing or malformed `extract.json`. A per-topic cursor reset (malformed
cursor, see Cursor state) does **not** by itself set `partialRun` — that
topic still gets fully processed, just with an empty starting cursor — so
`partialRun` stays a precise signal of "output is incomplete," not a
catch-all for "something unusual happened."

Body:

- If a cursor reset happened for one or more topics, a note immediately
  after the frontmatter (before any fact content) naming each affected
  topic and its cursor file path — kept grep-able at a fixed position
  rather than a loose "near the top."
- If zero new facts across every processed topic: single line,
  `No new facts detected.` — still writes the file, so run history stays
  complete (a topic with a real "nothing changed" run looks different from
  a topic that was never checked).
- Otherwise: new facts sorted by `source_id` then `factKey` (deterministic
  ordering → stable diffs between reports; `factKey` used instead of the
  unstable `FCT-###` id as the tiebreaker). In an `all`-topics report, each
  fact block is prefixed with its topic name (e.g. `[willow-run]`) since
  the merged-view `FCT-###` ids restart at 1 per topic and are not globally
  unique — without the prefix, facts from different topics would be
  visually indistinguishable in a combined report. Each block: topic name,
  display id (`FCT-###`, noted as position-only), fact text, confidence,
  source_id, suggested V-item match(es) with confidence bucket, or
  "unmatched."
- **Markdown escaping:** fact text, topic names, source IDs, and V-item
  claim text are all free-form data that may contain characters with
  markdown meaning (`#`, `|`, `` ` ``, `---`) — every such field is escaped
  (or wrapped in a fenced/quoted block) before insertion, so a fact
  containing e.g. a literal `---` line can't be mistaken for a new
  frontmatter delimiter by a later parser.
- Summary counts by topic and category at the end.

## CLI surface

- `trm sync-treatment` — all charlie topics.
- `trm sync-treatment <topic>` — single topic.
- `--dry-run` — runs the full diff/match/report pipeline but skips the
  cursor update.
- `--vault-root`, `--narrative-root`, `--dependency-map` — path overrides
  (see Architecture path contract).

**stdout/stderr contract:** stdout emits exactly the resolved report file
path and a one-line summary of counts (new-facts, matched, unmatched,
topics-skipped) — script-friendly, nothing else on stdout. All warnings
(missing extract, cursor reset, stale-lock reclaim) and errors go to
stderr.

Exit codes:

- `0` — success, all discovered topics processed (each either had an
  extract and was diffed, or is genuinely absent — see Topic discovery for
  the empty-set case).
- `1` — hard error: missing/unsupported dependency-map schema version,
  path-contract violation (output escapes narrative root), or a concurrent
  run detected (unstale lock present).
- `2` — partial success: one or more topic candidates skipped due to
  missing or malformed `extract.json`; `partialRun: true` in the report.

## Error handling

- Missing `extracts/extract.json` for a topic candidate → skip that topic
  with a warning (path included), continue processing remaining topics,
  contributes to exit code 2.
- Malformed `extract.json` (invalid JSON, or valid JSON failing the
  `{ facts: [...] }` shape check — each fact must have non-empty `id`,
  `text`, `source_id`; `source_id` is a required field per the `Fact` type
  in `trm/src/scoring/types.ts`, so a fact missing it is a schema
  violation, not a case needing a fallback sort key) → treated the same as
  missing: skip with a warning identifying it as a parse/schema failure
  (not silently folded into "missing"), contributes to exit code 2.
- Missing or unsupported `matchSchemaVersion` in the dependency-map JSON →
  hard error, exit code 1, message states the file path, the value found
  (or "absent"), and the versions this command supports.
- Malformed cursor for a topic → that topic's cursor only is treated as
  empty, warning logged with the cursor file path, "cursor reset" note
  written into the report for that topic. Does not set `partialRun`.
- Report output path resolving outside `<narrative-root>/treatment` (via
  symlink or unexpected root config) → hard error before any write, exit
  code 1.
- Lock already held by a live process → hard error, exit code 1, message
  names the lock file and the pid holding it.

## Testing

**Unit tests** (fixture `extract.json` + fixture dependency-map JSON, pure
functions, no real filesystem beyond in-memory fixtures):

- `factKey` stability: same fact content → same key regardless of position
  in the array; edited text → different key; reordering the whole
  `facts[]` array does not change any individual fact's key.
- New-vs-cursor diff logic keyed on `factKey`, including the
  all-already-synced case (zero new facts) and the edited-fact case (old
  key drops out, new key appears as "new").
- Matching/scoring formula: exact score for hand-computed fixture
  cases, multiple-matches-above-threshold (cap-at-3, tie-break by V-item id),
  confidence bucketing at each boundary (0.1, 0.3, 0.6 exactly), empty
  `categories` → `catScore = 0`.
- Missing/unsupported `matchSchemaVersion` → hard error thrown cleanly,
  message includes file path and found/supported versions.
- Report markdown generation: deterministic sort order, `[topic]`-prefix
  behavior in `all`-topics reports, markdown-special-character escaping
  (fact text containing `#`, `|`, `---`, backticks renders safely).
- `matchSchemaVersion` read from the dependency-map fixture propagates into
  the report's `matchVersion` field unchanged (no hardcoded value in the
  command); `matchConfigVersion` is independent of it.

**Integration tests** (real temp-directory filesystem, fixture vault +
narrative-root trees — this is the actual risk surface, not the pure
functions):

- Full run against a fixture vault: cursor files written, report written,
  correct content.
- Rerun immediately after: zero new facts, cursor unchanged.
- Malformed cursor JSON for one topic → that topic resets (fixture cursor
  file confirmed treated as empty), reset note appears in report, other
  topics' cursors are untouched, `partialRun` stays `false`.
- Malformed `extract.json` (invalid JSON) for one topic in an `all` run →
  that topic skipped, others processed normally, exit code 2,
  `partialRun: true`, `topicsSkipped` names it.
- Missing narrative-root directory → hard error before any write attempt.
- Report path escaping `<narrative-root>/treatment` via a symlinked
  narrative-root → hard error, nothing written, exit code 1.
- `--dry-run`: report file written with `DRYRUN` infix and `dryRun: true`,
  but the fixture cursor file is confirmed byte-for-byte unchanged
  afterward.
- Lockfile: second invocation while a lock is held (simulated live pid)
  fails fast with a distinct error; a stale lock (simulated dead pid) is
  reclaimed with a warning and the run proceeds.
- Simulated crash between report-write and cursor-update (test harness
  writes the report directly, then invokes only the cursor-update step,
  aborts partway) → rerun afterward produces a report with some duplicate
  facts (the ones whose cursor wasn't updated) — confirms the accepted
  duplicate-report behavior from Cursor state, not silent data loss.
- Zero-topics case (`all` run against an empty `topics/charlie/` fixture)
  → report says `No topics found.`, exit code 0.
- Report filename collision: two runs within the same second against the
  same topic → distinct `runId` suffixes, both files exist, neither
  overwritten.

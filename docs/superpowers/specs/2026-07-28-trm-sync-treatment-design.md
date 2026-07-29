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
before any processing starts.

**Report path validation, correctly ordered** (the naive approach —
`fs.realpathSync` on the final report path — fails outright, since that
file doesn't exist yet): resolve `fs.realpathSync(<narrative-root>/treatment)`
once (this directory must already exist), confirm the result has no
unexpected symlink components, then lexically join the candidate filename
onto that resolved path (no further filesystem resolution needed, since a
plain filename with no `..` or path separators can't escape a resolved
directory). The final file is created with exclusive-create semantics
(`wx` flag). If the initial `treatment` directory realpath fails or is
itself a symlink to somewhere unexpected, hard-error before generating any
content.

**Concurrency:** a lockfile at `<vault-root>/.sync-treatment.lock`,
containing `{ pid, hostname, runId, startedAt }`, is created exclusively
(`wx` flag) at the start of a run and removed in a `finally` block covering
every exit path, including hard errors. A second invocation while a live
lock exists fails fast with a distinct error naming the lock's pid and
`runId`. Reclaim is deliberately narrow: only when the recorded `hostname`
matches the current host (this is a single-user local tool; cross-host
lock claims are out of scope) *and* the recorded `pid` is confirmed dead
via liveness check — a live pid on the same host is never reclaimed
regardless of lock age, since a live pid alone doesn't prove non-ownership
but a *dead* pid on the same host does. A cross-host lock (hostname doesn't
match) is **never** auto-reclaimed regardless of age or pid liveness —
this is a single-user tool, so the realistic cross-host case is a crashed
machine or a vault copied from another machine, not a live conflicting
process — but never-auto-reclaim without an escape hatch means a crashed
remote host permanently blocks every future run. `--force-recover-lock`
is provided for exactly this case: deletes the lock unconditionally, with
a printed warning to confirm no other process is actually running against
this vault before using it. This is the one place in the design that
requires a human judgment call the tool cannot safely automate.

A malformed lock file (invalid JSON, or valid JSON missing `pid` or
`hostname`) is treated the same as an unrecoverable cross-host lock: fails
closed, points the user at `--force-recover-lock` in the error message,
rather than guessing at ownership from partial data.

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
manifestStore internals (no upstream stable per-fact provenance id exists to
key on instead — `manifestStore`'s `hash` is per-source, not per-fact, and
multiple facts share one source hash).

Two distinct facts from the same source with byte-identical normalized text
would collide on `factKey`. First-occurrence-wins was considered and
rejected: it silently drops the second fact from diffing/matching, which
is real data loss dressed up as a warning nobody has to read. Instead: a
collision within a topic's fact list is treated the same as a malformed
`extract.json` for that topic — the topic is skipped this run (see Error
handling), the warning names both colliding facts' display ids and the
shared `factKey`, and `topicsSkipped`/`partialRun` reflect it like any
other per-topic skip. This costs a full topic's worth of facts for one run
until the upstream duplicate is fixed, but that's a visible, actionable
failure instead of a quietly incomplete one. `factKeyCollisions` in
frontmatter counts topics skipped this way (0 in the normal case).

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

**Dependency-map envelope (one-time migration):** `CIC_SOURCING_DEPENDENCY_MAP_v1.json`
is currently a bare array (`[{ id, beat, claim, ... }, ...]`) — confirmed by
reading it directly. A top-level version field cannot be added to a bare
array, so as a one-time prerequisite (a manually-reviewed edit to the
narrative repo, done before this feature ships, not performed by the sync
tool itself) the file is restructured to an envelope object:

```json
{
  "matchSchemaVersion": 1,
  "items": [
    {
      "id": "V-5.3",
      "beat": "5.3",
      "claim": "...",
      "categories": ["biography", "industry"],
      "keywords": ["fleet", "consolidated", "san diego"]
    }
  ]
}
```

Confirmed safe: grepped every `.md`/script reference across
`charlie-deep-research/` — only prose docs mention the file by name; no
script (`scripts/code-review.js`, `scripts/generate-docs.js`,
`scripts/shared-utils.js`) parses it programmatically. Re-verify this at
implementation time in case new consumers were added since.

`categories`/`keywords` are new per-item fields, populated by hand as part
of the same migration (existing V-items don't have them yet — this is real
data-entry work, not inferred by the sync tool). Until an item has them,
its `categoryScore` (below) is `0` for every fact — it can still be matched
via `tokenScore` alone against its `claim` text.

The sync command requires `matchSchemaVersion` to be present and equal to a
version it recognizes (`1` for v1); missing or unrecognized → hard error
(exit code 1), message identifies the file, the found value, and supported
versions — never a silent default. Each `items[]` entry is validated:
non-empty `id` (unique across the array), non-empty `beat`, non-empty
`claim`; `categories`/`keywords` if present must be arrays of strings. Any
violation is a hard error (exit code 1, names the offending item's `id` or
array index) — matching cannot safely proceed against ambiguous reference
data, unlike a missing per-topic `extract.json`, which is a per-topic skip.

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
factTokens(f) = normalize(f.text) tokens, stopword-filtered, deduped
claimTokens(v) = normalize(v.claim) tokens, stopword-filtered, deduped
categoryScore(f, v) = Jaccard(f.categories, v.categories)          // 0 if v.categories absent/empty
keywordScore(f, v)  = Jaccard(factTokens(f), v.keywords)            // 0 if v.keywords absent/empty
claimScore(f, v)    = Jaccard(factTokens(f), claimTokens(v))        // always computable, the fallback signal
score(f, v) = round(0.4 * categoryScore + 0.3 * keywordScore + 0.3 * claimScore, 3)
```

This replaces the earlier (incorrect) version, which compared `f.categories`
— short labels like `"biography"` — against tokens scraped from `v.claim`
prose; a claim like "the subject concealed payments" would never literally
contain the word "biography," so that comparison was structurally
mismatched. `categories`/`keywords` are now explicit V-item fields (from
the migration above) compared against their fact-side counterparts
directly. `claimScore` is **not conditional** — it's weighted in on every
comparison, not just when `categories`/`keywords` are absent — it's more
accurate to call it an always-on additional signal than a "fallback": for
a fully-tagged V-item all three components contribute; for an untagged one,
`categoryScore`/`keywordScore` are simply `0` and `claimScore` is what's
left, which happens to look like a fallback in that specific case without
the formula actually branching on it anywhere.

Stopword list: a fixed, small, checked-in English stopword list (~100
common words) — same list used everywhere tokens are derived. Jaccard over
sets, not multisets (duplicate tokens deduped first). Missing/empty
`f.categories`, `v.categories`, or `v.keywords` → that component's score is
`0`, not an error and not skipped from the weighted sum.

Bucket the score: `>= 0.6` → high, `>= 0.3` → medium, `>= 0.1` → low, `< 0.1`
→ no match (goes to "unmatched" bucket). Thresholds are inclusive at the
lower bound of each named bucket. These constants plus the 0.4/0.3/0.3
weighting live together under `matchConfigVersion: 1` — changing any of
them is a version bump, not a silent tuning edit, so old reports remain
interpretable against the config version that produced them.

Cap suggested matches at 3 per fact (highest-scoring first; ties broken by
V-item `id` ascending, string comparison). Facts scoring below 0.1 against
every V-item go in the "unmatched" bucket.

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
vaultSnapshot:
  willow-run: <mtime of that topic's extract.json>
  cuba: <mtime of that topic's extract.json>
matchVersion: <matchSchemaVersion from dependency-map file>
matchConfigVersion: 1
cursorVersion: 1
partialRun: false
dryRun: false
factKeyCollisions: 0
topicsProcessed: ["willow-run", "cuba"]
topicsSkipped: []
---
```

`vaultSnapshot` is a per-topic map, not a single scalar — a single run-wide
timestamp would be misleading once more than one topic is processed, since
each topic's `extract.json` has its own independent modification time.
**Read-then-stat ordering matters for correctness, not just style:** the
command reads the file's content first, then immediately stats it for
`mtime` — never the reverse — so the recorded timestamp always corresponds
to data at least as new as what was actually parsed. A concurrent external
edit between those two steps would only ever make the recorded
`vaultSnapshot` look slightly newer than the exact bytes read, never
older/stale; given the lockfile already prevents concurrent *sync-treatment*
runs, the realistic source of such an edit is a human editing
`extract.json` by hand mid-run, which is out of scope to guard against
further.

`partialRun` is `true` if and only if `topicsSkipped` is non-empty — i.e.
at least one topic candidate (from Topic discovery) was skipped due to a
missing/malformed `extract.json` or a `factKey` collision (see Fact
identity — collisions are now a skip, not a silent merge). A per-topic
cursor *reset* (malformed or unsupported-version cursor, see Cursor state)
does **not** by itself set `partialRun` — that topic still gets fully
processed, just with an empty starting cursor.

**No `cursorUpdateIncomplete` field in frontmatter** — deliberately. Cursor
updates happen strictly after the report is written, so any field claiming
to describe their outcome would necessarily be stale the moment a
post-write cursor failure occurs (the report is already committed to disk
before that failure can happen). Rather than ship a field that lies in
exactly the case it exists to describe, that signal lives *only* in the
command's exit code (`2`) and a stderr message naming the affected topics
— see Error handling. A report's frontmatter describes the world as of
report-write time; the exit code describes the whole run.

Body, in this fixed order:

1. **Skipped topics section** (present whenever `topicsSkipped` is
   non-empty, regardless of whether any processed topic has new facts):
   a `## Skipped topics` heading listing each skipped topic and the reason
   (`missing extracts/extract.json` or `malformed extracts/extract.json:
   <parse error>`). If every discovered topic was skipped, this is the
   entire body aside from frontmatter — still a valid, non-empty report.
2. **Cursor reset note**, if one or more topics had a reset this run —
   naming each affected topic, its cursor file path, and whether the reset
   was due to malformed JSON or an unsupported `cursorVersion` — kept
   grep-able at this fixed position.
3. **Fact content**, one of:
   - `No new facts detected.` if zero new facts across every *processed*
     topic (a topic can be both skipped-and-absent-from-this-line and the
     rest can still say this — the two conditions aren't mutually exclusive
     and both render).
   - Otherwise, new facts sorted by `source_id` then `factKey`
     (deterministic ordering → stable diffs between reports; `factKey`
     used instead of the unstable `FCT-###` id as the tiebreaker). In an
     `all`-topics report, each fact block is prefixed with its topic name
     (e.g. `[willow-run]`) since the merged-view `FCT-###` ids restart at 1
     per topic and are not globally unique. Each block, with explicitly
     distinct field names so extraction confidence and match confidence
     are never conflated:

     ```text
     [willow-run] FCT-014 (display id, position-only — see Fact identity)
     Source: SRC-001
     Fact confidence: 0.85
     Text:
         <fact text, indented 4 spaces — never inside this template's own fence>
     Suggested matches:
       V-5.3 — match confidence: high (score 0.72)
       V-6.2a — match confidence: low (score 0.15)
     ```

     (the outer triple-backtick fence above is this *spec document's*
     illustration of the template shape, not what the tool emits — the
     tool emits the labels/structure as plain markdown text, with only the
     free-form `<fact text>` value indented 4 spaces per point 4 below,
     since a real fenced block wrapping untrusted content would itself be
     breakable by a fact whose text contains a triple-backtick line)

     or `Suggested matches: unmatched` when nothing scored >= 0.1.
4. **Markdown escaping — one deterministic representation, not a choice
   made per-case:** fact text, topic names, source IDs, and V-item claim
   text are free-form data that may contain markdown-meaningful characters.
   Every such field is rendered as an indented plain-text block (4-space
   indent, the CommonMark "indented code block" form), never inline
   markdown and never a fenced block — a fenced block picked per-content
   would need dynamically-counted backtick runs to be safe against text
   that itself contains backtick fences, which is exactly the kind of
   per-case decision this is meant to avoid. A 4-space-indented block has
   no delimiter for its content to collide with, so no fence-length
   negotiation is ever needed.
5. **Summary counts** by topic and category at the end.

## CLI surface

- `trm sync-treatment` — all charlie topics.
- `trm sync-treatment <topic>` — single topic.
- `--dry-run` — runs the full diff/match/report pipeline but skips the
  cursor update. (Considered renaming to `--no-cursor-update` since it
  still writes a real report file, not a conventional side-effect-free
  dry run — kept `--dry-run` per earlier design sign-off, but see the
  `DRYRUN`-infix filename and `dryRun` frontmatter field in Report output,
  which exist precisely to keep this distinction visible in practice.)
- `--vault-root`, `--narrative-root`, `--dependency-map` — path overrides
  (see Architecture path contract).
- `--force-recover-lock` — deletes an existing lockfile unconditionally
  before proceeding (see Architecture's Concurrency section); the only
  manual escape hatch for a cross-host or malformed lock.

**stdout/stderr contract:** stdout emits exactly the resolved report file
path and a one-line summary of counts (new-facts, matched, unmatched,
topics-skipped, and `factKeyCollisions` when nonzero) — script-friendly,
nothing else on stdout. All warnings (missing extract, cursor reset,
stale-lock reclaim) and errors go to stderr.

Exit codes:

- `0` — success, all discovered topics processed (each either had an
  extract and was diffed, or is genuinely absent — see Topic discovery for
  the empty-set case), and every touched cursor was written successfully.
- `1` — hard error, nothing written: missing/unsupported dependency-map
  schema version or invalid dependency-map item, path-contract violation
  (output would escape narrative root), an unrecoverable lock (live
  same-host lock, any cross-host lock, or a malformed lock file — see
  Architecture), or a concurrent run detected.
- `2` — partial success: one or more topic candidates skipped due to
  missing/malformed `extract.json` or a `factKey` collision
  (`partialRun: true`), **or** the report was written successfully but one
  or more post-write cursor updates then failed (this can occur even when
  `partialRun` is `false` — see Error handling's cursor-write-failure
  bullet for what stderr reports in that case).

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
- `factKey` collision within a topic (two facts, same key — see Fact
  identity) → that topic is skipped this run, same as a malformed
  `extract.json`: warning names both colliding facts' display ids and the
  shared key, contributes to exit code 2, counted in `factKeyCollisions`.
- Missing or unsupported `matchSchemaVersion` in the dependency-map JSON, or
  an `items[]` entry failing validation (duplicate/empty `id`, empty
  `beat`/`claim`, non-string-array `categories`/`keywords`) → hard error,
  exit code 1, message states the file path plus the specific value or
  item `id`/index that failed, and (for schema version) the versions this
  command supports.
- Malformed cursor JSON, or a cursor with an unrecognized `cursorVersion`
  (anything other than `1`), or `lastSyncedFactKeys` not an array of
  strings → that topic's cursor only is treated as empty (full reset),
  warning logged with the cursor file path and the specific reason
  (parse failure vs. unsupported version vs. bad shape), "cursor reset"
  note written into the report for that topic. Does not set `partialRun`.
- Report output path resolving outside `<narrative-root>/treatment` (via
  symlink or unexpected root config) → hard error before any write, exit
  code 1.
- **Cursor write failure after a successful report write** (e.g. disk full,
  permissions) → does not roll back or rewrite the already-committed
  report (see the frontmatter-omission note under Report output). Exit
  code `2`; stderr includes, in one message: the report file's path
  (already written, still useful), which specific topic(s) failed to
  persist their cursor, whether any other touched topics' cursors
  succeeded, and an explicit note that a rerun is safe (won't lose data)
  but will duplicate some facts already shown in this report.
- Lock already held by a live process on the same host → hard error, exit
  code 1, message names the lock file, pid, and `runId` holding it.
- Lock held by a different host, or lock file malformed (invalid JSON, or
  missing `pid`/`hostname`) → hard error, exit code 1, fails closed rather
  than guessing at ownership; message points at `--force-recover-lock` as
  the manual escape hatch and warns to confirm no other process is
  actually running against this vault first.

## Testing

**Unit tests** (fixture `extract.json` + fixture dependency-map JSON, pure
functions, no real filesystem beyond in-memory fixtures):

- `factKey` stability: same fact content → same key regardless of position
  in the array; edited text → different key; reordering the whole
  `facts[]` array does not change any individual fact's key.
- `factKey` collision: two fixture facts with identical `source_id` and
  identical normalized text → that topic treated as skipped (not merged),
  warning names both facts' display ids and the shared key,
  `factKeyCollisions` count reflects the skipped-topic count.
- Malformed dependency-map envelope (bare array instead of
  `{ matchSchemaVersion, items }`, or valid JSON missing `items`) → hard
  error thrown cleanly, distinct from a missing/unsupported version.
- Malformed lock file (invalid JSON, or missing `pid`/`hostname`) → treated
  as unrecoverable, error message points at `--force-recover-lock`.
- New-vs-cursor diff logic keyed on `factKey`, including the
  all-already-synced case (zero new facts) and the edited-fact case (old
  key drops out, new key appears as "new").
- Matching/scoring formula: exact score for hand-computed fixture cases
  covering all three components (`categoryScore`, `keywordScore`,
  `claimScore`), including a V-item with no `categories`/`keywords`
  (falls back to `claimScore` alone), multiple-matches-above-threshold
  (cap-at-3, tie-break by V-item id), confidence bucketing at each
  boundary (0.1, 0.3, 0.6 exactly).
- Dependency-map validation: missing/unsupported `matchSchemaVersion` →
  hard error; duplicate `items[].id` → hard error; empty
  `claim`/`beat` → hard error; non-string-array `categories`/`keywords` →
  hard error. Each names the file path and offending item.
- Cursor validation: unsupported `cursorVersion` (e.g. `99`) → treated as
  reset with a distinct warning message from a JSON-parse failure;
  non-array `lastSyncedFactKeys` → same reset treatment.
- Report markdown generation: deterministic sort order, `[topic]`-prefix
  behavior in `all`-topics reports, markdown-special-character escaping
  (fact text containing `#`, `|`, `---`, backticks renders safely),
  distinct "Fact confidence" vs. "match confidence" field labels never
  conflated in output.
- `matchSchemaVersion` read from the dependency-map fixture propagates into
  the report's `matchVersion` field unchanged (no hardcoded value in the
  command); `matchConfigVersion` is independent of it.
- **Determinism:** given fixed `runId` and `runAt` inputs (injected, not
  generated), two separate invocations against identical fixtures produce
  byte-identical report bodies and frontmatter (excluding fields that are
  supposed to vary, which there are none once `runId`/`runAt` are fixed).

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
- Lockfile: second invocation while a same-host lock is held (simulated
  live pid) fails fast with a distinct error; a stale same-host lock
  (simulated dead pid) is reclaimed with a warning and the run proceeds.
- Cross-host lock (simulated dead pid, different `hostname`) is *not*
  auto-reclaimed — hard error pointing at `--force-recover-lock`; running
  with that flag deletes the lock and the subsequent run proceeds.
- Zero-topics report frontmatter explicitly asserts `topicsProcessed: []`
  and `topicsSkipped: []` (not just the "No topics found." body text).
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
- Cursor write failure after report write (simulate by making one topic's
  cursor path unwritable, e.g. read-only file/directory on the test
  platform) → report still contains that topic's facts normally (frontmatter
  reflects success at write-time, per the stated limitation), exit code 2,
  stderr names the topic, and a rerun afterward re-surfaces that topic's
  facts as still-new (cursor genuinely wasn't updated — confirms no silent
  data loss).
- stderr summary line includes `factKeyCollisions` count when nonzero,
  alongside the existing new-facts/matched/unmatched/topics-skipped counts.

**Platform note:** atomic replace-on-rename is exercised on whatever
platform CI/dev runs on (this repo is Windows-primary). Node's
`fs.renameSync` is documented to perform an atomic replace via libuv on
both POSIX and Windows (`MoveFileExW` with replace-existing), for files on
the same volume — the temp-file-same-directory rule in Cursor state exists
specifically so this guarantee holds. No separate Windows-specific
replacement strategy is needed beyond that same-directory rule; if a test
run ever demonstrates otherwise on this repo's actual Node/Windows version,
that's a real bug to fix, not a design gap to pre-solve speculatively.

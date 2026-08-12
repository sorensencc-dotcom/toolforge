# NotebookLM → CIC/trm Ingest & Reverse-Mining Design

**Status:** APPROVED (rev 3 — exact MCP response shapes + CLI contracts, see §0)
**Date:** 2026-08-12
**Target Path:** `docs/superpowers/specs/2026-08-12-notebooklm-cic-ingest-mining-design.md`
**Governing Subsystems:** `trm`, `charlie-deep-research`, `notebooklm-mcp`

## 0. Revision Note

Rev 1 invented a raw-Markdown staging format, a content-based classifier, and a
new atomic/synthesis triage classifier — none of which exist in trm. Rev 2 was
rewritten after reading `trm/src/core/{rawSource,sourceIngest,topicRouting,
intakeManifest}.ts` and `trm/src/cli/commands/{routeIntake,ingest,extract,
syncTreatment}.ts` directly, but still hand-waved the NotebookLM adapter side
(note content retrieval, exact CLI invocations/exit codes, retry semantics,
key collisions).

Rev 3 closes those gaps against **live-called** MCP tools, not assumed
shapes, plus `trm/src/cli/index.ts` for the exact Commander contracts:

- `mcp__notebooklm-mcp__note(notebook_id, action="list")` called live against
  the `CIC-KB` notebook (`679b8bab-...`) → confirmed each returned note object
  already carries full `content` (not just `preview`); see §3.1.
- `mcp__notebooklm-mcp__source_list_drive(notebook_id, skip_freshness=true)`
  called live → confirmed real response shape (`drive_sources`/
  `other_sources`, each `{id, title, type}`); see §3.1.
- `mcp__notebooklm-mcp__source_get_content(source_id)` called live → confirmed
  real response shape (`{status, content, title, source_type, char_count}`);
  see §3.1.
- Real data surfaced a name mismatch worth flagging: `notebook_list`'s
  `source_count` for CIC-KB reports 2, but `source_list_drive` on the same
  notebook returns 4 `other_sources` (including two same-titled
  `repo_knowledge_pack.txt` entries). The pipeline does not reconcile this
  discrepancy — it trusts `source_list_drive` as the enumeration source of
  truth and relies on route-intake's existing basename-collision suffixing
  (§3.4 step 3) for the duplicate title.

This pipeline still does not introduce any new staging format, classifier, or
triage schema — it drives trm's existing
intake→route→ingest→extract→sync-treatment chain unchanged, adding only a
NotebookLM-specific pull step at the front and a mining step alongside it.

## 0.1 Integration Boundary Correction (pre-implementation)

§0/§3.1 verified response shapes via the `notebooklm-mcp` **MCP tool calls**,
which are only invokable by the agent in a chat session — trm's `ingest-
notebooklm`/`mine-notebooklm` commands are a Node.js CLI that runs
unattended (including from the Task Scheduler wrapper, §5), so they cannot
make MCP tool calls themselves. The underlying tool ships as both an MCP
server *and* a plain CLI (`notebooklm-mcp-cli` package, `nlm` command,
confirmed on PATH) — the CLI is what trm's orchestrator shells out to.

The CLI's `--json` output shapes were verified live and differ from the MCP
tool shapes documented in §3.1:

- `nlm source list <notebook_id> --json --skip-freshness` → a bare array,
  each entry `{id, title, type, url}` (`url` present here, absent from the
  MCP `source_list_drive` shape).
- `nlm source content <source_id> --json` → `{content}` only — no `title`/
  `source_type`/`char_count` fields the MCP tool includes. Title must be
  sourced from the `source list` call instead.
- `nlm note list <notebook_id> --json` → `{notebook_id, notes}`, each note
  `{id, title, content}` — no `preview`, no top-level `status`/`count`.

The implementation plan (see companion plan doc) targets these CLI shapes
as the real contract. §3.1's MCP shapes remain accurate documentation of
what the *agent* sees when driving this manually, but are not what the
unattended orchestrator parses.

## 1. Goal

Two complementary pipelines around the CIC-relevant NotebookLM notebooks:

1. **Forward ingest** — pull research discoveries (chat notes + source content) out of NotebookLM notebooks, land them in trm through the existing intake pipeline, and let trm's existing `sync-treatment` report surface which new facts are relevant to `charlie-deep-research` treatment updates.
2. **Reverse mining** — query notebooks with a fixed question set to surface open questions, under-sourced claims, and adjacent research gaps.

Loop between the two is **manual by design**: mining output lands in a doc + TODOS.md; a human decides which questions to chase further in NotebookLM. No auto-triggered `research_start`/`research_import` calls.

## 2. Scope & Registry

Only CIC-relevant notebooks participate, registered manually. **v1 registers all five notebooks below explicitly** — not a subset, not auto-discovered from the full `notebook_list` (which also returns unrelated personal notebooks: bourbon, VS Code, recipes, etc., excluded by simply never adding them to this file).

New file: `trm/config/notebooklm-registry.json`

```json
{
  "version": 1,
  "notebooks": [
    {
      "notebook_id": "679b8bab-2d87-42cb-a726-6dc54c83acc2",
      "title": "CIC-KB",
      "url": "https://notebooklm.google.com/notebook/679b8bab-2d87-42cb-a726-6dc54c83acc2",
      "last_pulled_hashes": {},
      "last_seen_note_ids": [],
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "1b4861a3-931f-4632-8fc1-343a8dd37df8",
      "title": "CIC - Daily Research",
      "url": "https://notebooklm.google.com/notebook/1b4861a3-931f-4632-8fc1-343a8dd37df8",
      "last_pulled_hashes": {},
      "last_seen_note_ids": [],
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "ef78168d-b7b9-4952-8e0f-fcb353a21181",
      "title": "Willow Run Videos",
      "url": "https://notebooklm.google.com/notebook/ef78168d-b7b9-4952-8e0f-fcb353a21181",
      "last_pulled_hashes": {},
      "last_seen_note_ids": [],
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "b8bc161d-495f-42f9-a7d1-ed8692141f6b",
      "title": "Cast Iron Charlie - Research Logs",
      "url": "https://notebooklm.google.com/notebook/b8bc161d-495f-42f9-a7d1-ed8692141f6b",
      "last_pulled_hashes": {},
      "last_seen_note_ids": [],
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "fd0e0e4e-6890-4fb9-89bf-b9e568295e7a",
      "title": "The Sorensen Photographic Archive: Industrial Giants at Willow Run",
      "url": "https://notebooklm.google.com/notebook/fd0e0e4e-6890-4fb9-89bf-b9e568295e7a",
      "last_pulled_hashes": {},
      "last_seen_note_ids": [],
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    }
  ]
}
```

`last_pulled_hashes` maps a **namespaced** key to `sha256(content)`:
`source:<source_id>` for `source_get_content` pulls, `note:<note_id>` for
`note(action=list)` pulls. The namespace prefix is required, not cosmetic —
NotebookLM source UUIDs and note UUIDs are drawn from separate ID spaces with
no documented uniqueness guarantee across them; an unprefixed key risks a
source and a note colliding on the same hash-map entry and one silently
shadowing the other's change-detection state. `last_seen_note_ids` from rev 2
is dropped — notes now live in `last_pulled_hashes` under the `note:` prefix
alongside sources, one map instead of two.

`registry.notebooks[i].quarantined` (new in rev 3, see §3.2) maps the same
namespaced key to `{hash, reason, first_seen_at, last_seen_at, attempts}` for
items that failed or came back empty.

No notebook is added or removed from this file automatically; adding a sixth
CIC notebook later is a manual one-line edit here, same as today's trm topic
registration is manual (`trm create topics/charlie/<topic>`).

## 3. Forward Ingest Pipeline

New command: `trm ingest-notebooklm <notebook-id>`. Drives trm's existing CLI
commands as subprocesses/library calls in sequence — it does not reimplement
any of their logic.

### 3.1 Pull

For each notebook in the registry (or the one given on the command line):

**Enumerate sources** — `source_list_drive(notebook_id, skip_freshness=true)`.
Confirmed live response shape:

```json
{
  "status": "success",
  "notebook_id": "<uuid>",
  "drive_sources": [],
  "other_sources": [
    { "id": "<uuid>", "title": "memcode-ai/memcode", "type": "web_page" },
    { "id": "<uuid>", "title": "repo_knowledge_pack.txt", "type": "generated_text" }
  ],
  "drive_count": 0,
  "stale_count": 0
}
```

Both `drive_sources` and `other_sources` arrays are enumerated (Drive-backed
sources go stale and need `source_sync_drive` first — out of scope here,
logged and skipped if `stale_count > 0` for an item, see §6).

**Pull content per source** — `source_get_content(source_id)`. Confirmed live
response shape:

```json
{
  "status": "success",
  "content": "<full extracted text, plain>",
  "title": "memcode-ai/memcode",
  "source_type": "unknown",
  "char_count": 20355
}
```

Note `source_list_drive`'s `type` field (`"web_page"`) and
`source_get_content`'s `source_type` field (`"unknown"` for the same source)
are not the same value — the two endpoints don't share a type vocabulary.
This pipeline uses `source_list_drive`'s `type` for YouTube detection (see
below) since it's the field actually populated meaningfully; `source_type` is
recorded in the staged file's frontmatter for reference but not branched on.

**Pull notes** — `note(notebook_id, action="list")`. Confirmed live response
shape (full content present, not just preview):

```json
{
  "status": "success",
  "action": "list",
  "notebook_id": "<uuid>",
  "notes": [
    { "id": "<uuid>", "title": "...", "content": "<full note markdown>", "preview": "<first ~100 chars>" }
  ],
  "count": 5
}
```

`content` is used directly; `preview` is not needed. `note` has no `get`
action and none is required — `list` already returns full content for every
note in one call, confirmed against a live 5-note notebook.

**YouTube / derived provenance** — a source is treated as derived when
`source_list_drive`'s `type` for that source is `youtube` (exact enum value
to be confirmed against a real YouTube-backed notebook — `Willow Run Videos`,
`ef78168d-...` — during implementation; not yet observed live in this design
pass since CIC-KB has no YouTube sources). For derived sources,
`source_get_content` returns NotebookLM's summary, not a raw transcript. The
staged file gets a `<!-- provenance: derived -->` marker as its first line,
and `--origin notebooklm-derived` instead of `--origin notebooklm` at the
`trm ingest` step (§3.4).

### 3.2 Change detection & quarantine

For each pulled item, compute `sha256(content)` and look up the namespaced
key (`source:<id>` or `note:<id>`) in both `last_pulled_hashes` and
`quarantined`:

- Not in either map → new item, proceeds to staging.
- In `last_pulled_hashes` with the same hash → unchanged, skipped, not
  re-pulled into `intake/`.
- In `last_pulled_hashes` with a different hash → changed item, proceeds
  (re-processed as if new; trm has no "supersede a fact" operation, so an
  edited NotebookLM source produces a second physical file rather than
  mutating history — consistent with how trm treats all sources as immutable
  once ingested).
- In `quarantined` with the **same** hash as recorded → still-bad content
  (empty, or the same MCP error signature), skipped without re-attempting
  the downstream pipeline. This bounds retries: a permanently-empty source
  is only logged once, not every run forever.
- In `quarantined` with a **different** hash → content changed since the
  quarantined attempt, retried normally as a new item; on success the
  `quarantined` entry for that key is deleted.

Content that comes back empty or as an MCP error payload (§6) is written to
`quarantined[key]` — `{hash, reason, first_seen_at, last_seen_at, attempts}`
— with `attempts` incremented and `last_seen_at` refreshed even when the
hash is unchanged, so a human auditing the registry can see it's still being
checked, not silently forgotten.

### 3.3 Stage into `intake/`

Existing trm raw-intake is **physical-file-and-path based**
(`triage-intake` hashes/classifies files under `intake/`; `route-intake`
classifies by keyword match against the file's *path string*, per
`classifyPath()` in `topicRouting.ts` — it does not read file content). To
use that pipeline unchanged, each new/changed pulled item is written as a
real file:

```text
intake/notebooklm/<notebook-slug>/<source-or-note-id>--<slugified-title>.md
```

The slugified title is required, not cosmetic — `classifyPath` keyword-matches
against `trm/config/topic-routing.json` entries by scanning the normalized
path string. A bare id-only filename would never match any topic and every
item would land `unsorted`. The notebook-slug directory segment is
intentionally *not* fed into classification value (it's a fixed constant per
notebook, contributes no discriminating keywords) — it exists purely for
human browsability of `intake/`.

File content: the pulled text/derived-summary, verbatim, plus the
provenance marker from §3.1 for derived items.

### 3.4 Drive existing pipeline, unmodified — exact invocations

All commands below run from the vault root (`assertSafeRoot(root)` requires
`process.cwd()` to be a valid trm vault, matching every other trm command —
the orchestrator spawns these as child processes with `cwd` set to the vault
root, not as in-process library calls, so a crash in one step can't take
down the orchestrator's own process state).

1. `trm triage-intake --dir intake/notebooklm/<notebook-slug>` — hashes
   files, classifies `kind: 'text'` (zero-cost, `.md` is in
   `TEXT_EXTENSIONS`), writes `intake-manifest.json` entries with
   `status: 'done'`. No `--type`/`--title`/`--origin` flags at this step —
   those belong to `ingest`, not `triage-intake`. Exit code: 0 always
   (command has no failure exit path in current source); the orchestrator
   checks the printed summary JSON's `failedCount`/`walkErrorCount` instead
   of relying on a nonzero exit.
2. `trm route-intake --apply` — classifies each manifest entry by path via
   `classifyPath()`, stages matched entries into
   `topics/charlie/<topic>/_staging-intake-<runId>/`. Entries with
   `ambiguous: true` or no keyword match get `topic: null` and are **not**
   staged — same "lands unsorted, needs manual reroute" behavior as any
   other unsorted intake today. Exit code 1 if `runStatus !== 'completed'`
   (e.g. preflight failure on a missing topic node, §6) — orchestrator
   treats nonzero exit as "abort this notebook's run, others continue."
3. For each staged file, run:

   ```text
   trm ingest <topicPath> <sourceUrl> \
     --file <stagedPath> \
     --type notebooklm-source \
     --title <source_title> \
     --origin notebooklm[-derived]
   ```

   `--type` is a fixed literal, not inferred — `type` has no enum in trm
   (free-text field on `SourceEntry`, confirmed in `sourceIngest.ts`; no
   existing convention value found repo-wide to reuse). This pipeline
   defines exactly two literals: `notebooklm-source` for pulled sources,
   `notebooklm-note` for pulled notes. `<sourceUrl>` positional arg is the
   notebook's source URL for sources, or
   `https://notebooklm.google.com/notebook/<notebook_id>?note=<note_id>`
   (constructed, NotebookLM has no native note-permalink API) for notes.
   `--origin` is `notebooklm` for primary content, `notebooklm-derived` for
   YouTube-derived summaries (§3.1). This is the real `addSource` +
   `writeRawEnvelope` call (`kind: 'text'`) — no command wrapping or
   reimplementation. `ingest` has no summary/exit-code contract on failure
   in current source (throws on error, uncaught → nonzero process exit) —
   orchestrator wraps each call in try/catch, logs, continues to the next
   staged file rather than aborting the whole batch on one bad file.
4. `trm extract <topicPath>` — unmodified, run once per distinct topic that
   received at least one successful `ingest` in step 3 (not once per file).
   Produces `extracts/extract.json` (`Fact[]`) and `extracts/summary.md`
   exactly as it does for any other source. **There is no separate
   atomic-vs-synthesis split to build**: `extract.json` already holds the
   atomic facts, and `summary.md` already holds the runner's narrative
   synthesis. Both artifacts already exist per the current extraction
   contract.

### 3.5 Cross-repo write: reuse `sync-treatment`, don't invent one

`trm sync-treatment` already owns the vault→`charlie-deep-research` boundary:
lock file (`.sync-treatment.lock`), atomic report write, per-topic cursor
(`.sync-cursor.json`), and fact-vs-dependency-map matching
(`CIC_SOURCING_DEPENDENCY_MAP_v1.json` in `narrativeRoot/treatment/`). This
pipeline does not write into `charlie-deep-research` directly and does not
introduce a second cross-repo write path.

Exact invocation, **unscoped** (no topic argument) and run unconditionally
at the end of every `trm ingest-notebooklm` run, whether or not any topic
was actually touched:

```text
trm sync-treatment --narrative-root C:\dev\charlie-deep-research
```

Running unscoped is deliberate, not an open question: `runSyncTreatment`
with no `topic` calls `discoverTopics()` and walks every topic under
`topics/charlie/` regardless of what this run touched, comparing each one's
`extract.json` against its own `.sync-cursor.json`. It is already idempotent
per-topic (a topic with no new fact keys since its last cursor write is a
no-op in the report). There is nothing to "collect" — invoking it
unconditionally is simpler than tracking touched-topics and produces an
identical result, since untouched topics are no-ops either way. If zero
topics routed successfully this run (everything landed `unsorted`),
`sync-treatment` still runs safely and its report reflects zero new facts
from this run specifically (other topics may still show new facts from
unrelated concurrent work — that's existing, correct behavior, not something
this pipeline changes).

`sync-treatment`'s report — not a new draft-block mechanism — is the human
review surface for treatment updates. Exit code 2 if any topic was skipped
or its cursor write failed (existing behavior); orchestrator surfaces this
in its own run report (§3.6) rather than treating it as a hard failure of
the ingest run, since the ingest side effects (staged facts) already landed
successfully regardless of sync-treatment's own bookkeeping outcome.

### 3.6 Registry update: per-item flush, plus a durable run report

Rev 2 batched the registry write to the end of the run, so a crash after
staging/ingesting/extracting but before the final write would cause the next
run to redo work already reflected in trm's own state (duplicate
`SourceEntry` rows in `sources/metadata.json`, since `trm ingest` always
appends a new `SRC-nnn` — it has no idempotency of its own for repeated
calls with the same content).

Rev 3 instead flushes the registry **after each item's `trm ingest` call
succeeds**, mirroring trm's own `openIntakeManifest`/`writeIntakeEntry`
pattern (load once, mutate in memory, atomic flush per entry) rather than
inventing a new persistence model. This bounds the blast radius of a
mid-run crash to at most the one item in flight, not the whole run.

In addition, the orchestrator writes a durable run report — same pattern as
`route-intake`'s own `intake-routing-report.json` — to
`.nlm-ingest-reports/<runId>.json` before starting item processing, updated
as each item completes (`staged` / `ingested` / `extracted` / `quarantined`
/ `failed` per item). This is the recovery source of truth if the registry
write itself fails after an item succeeds (§6): a human (or the next run's
preflight) can diff the latest run report against the registry's
`last_pulled_hashes` to spot any item marked `ingested` in the report but
missing from the registry, and reconcile by hand rather than silently
re-ingesting it as a duplicate `SourceEntry`. The orchestrator does not
attempt automatic reconciliation — flagging the mismatch and refusing to
auto-retry that specific item is the safer default given trm's lack of
ingest idempotency.

## 4. Reverse-Mining Pipeline

New command: `trm mine-notebooklm <notebook-id>` (on-demand) + scheduled
weekly sweep across all registry notebooks. This pipeline does not touch
trm's intake/extract/sync-treatment chain at all — it only reads from
NotebookLM and writes to a standalone doc + TODOS.md.

Fixed, versioned question set — `trm/config/mining-questions.json`:

```json
{
  "version": 1,
  "questions": [
    { "id": "open-contradictions", "text": "What open questions or unresolved contradictions exist across these sources?" },
    { "id": "under-sourced", "text": "What claims are asserted but single-sourced or under-corroborated?" },
    { "id": "adjacent-topics", "text": "What adjacent topics do these sources point to that aren't covered yet?" },
    { "id": "follow-up", "text": "What follow-up research would most strengthen current findings?" }
  ]
}
```

Each question carries a stable `id`, independent of its `text`. Run each
question via `notebook_query` against the notebook.

### 4.1 Dedup & provenance key

Rev 1 hashed only answer text, which would duplicate an entry if wording or
ordering shifted between runs with no real content change. The stable key
for a mined entry is the compound:

```text
<notebook_id>:<question_id>:sha256(answer_text)
```

`registry.notebooks[i].last_mined_answer_keys` stores the list of compound
keys already written to the output doc. A run only appends a new row when
its compound key isn't already in that list — this naturally handles both
"nothing changed" (same key, skip) and "answer changed" (new hash, new key,
new row appended rather than replacing the old one, preserving history of
what the answer used to say).

### 4.2 Output

Both land, every run with new content:

- `trm/<topic>/open-questions.md` for single-topic notebooks, or
  `trm/research-gaps/<notebook-slug>.md` for multi-topic notebooks (Daily
  Research). Table columns: Question | Answer excerpt | Notebook | First-seen
  date | Entry key.
- Answers matching an urgency heuristic ("needs verification", "recommend
  investigating", "no source found") also appended as new `TODOS.md` Open
  entries. Idempotent via the same compound key — a TODOS line is only added
  once per compound key, checked by scanning existing Open/Completed entries
  for the key before appending.

### 4.3 Loop closure is manual

No question here auto-triggers `research_start`/`research_import`. You read
the doc/TODOS entries and decide which to chase; chasing means manually
invoking NotebookLM research tools yourself.

## 5. Scheduling Infra

Windows Task Scheduler wrapper, matching the existing kb-sync pattern
(`schedule-task-wrapper-KB-Sync-*.ps1`):

- New: `schedule-task-wrapper-TRM-Notebooklm-Mine.ps1` — weekly sweep, all
  registry notebooks, calling `trm mine-notebooklm` per notebook.
- `trm ingest-notebooklm` stays on-demand only, not scheduled — discoveries
  are sourced by manually finding them in a notebook, not a passive drip.

Not using Claude Code's cloud `schedule`/`CronCreate` skill: `notebooklm-mcp`
is a local MCP server bound to this machine's browser auth session; a
cloud-run routine cannot reach it.

Weekly cadence for mining — research corpora don't churn like calendar/email;
daily sweeps on a 305-source notebook would add noise and cost without
proportional signal.

## 6. Error Handling

- Notebook unreachable / auth expired (`nlm login` needed): that notebook is
  skipped for the run (both ingest and mining), others continue. Registry
  timestamps for the failed notebook are left untouched so it's retried
  fully next run, not partially skipped.
- `route-intake --apply` preflight failure (missing topic node for a
  classified item): matches existing behavior exactly — run aborts before
  staging anything for that topic, reports `missing topic node(s): ... run
  "trm create topics/charlie/<topic>" first`. This pipeline does not
  auto-create topic nodes; same manual gate as any other intake today.
- Malformed/empty NotebookLM content (`source_get_content`/`note(action=list)`
  returns an empty `content` string, a non-`"success"` `status`, or an
  MCP-level error/timeout): item is written to `quarantined[key]` (§3.2)
  rather than `intake/`, with `reason` set to the error message or
  `"empty content"`. Not retried every run — only re-attempted once the
  item's content hash changes (§3.2). Never staged as an empty file that
  would produce a hollow fact.
- Registry per-item flush failing mid-run (disk full, permissions): that
  item's ingest side effect (staged file, `SourceEntry`, raw envelope) has
  already landed and is not rolled back. The durable run report (§3.6) still
  records the item as `ingested`, so the mismatch between report and
  registry is detectable and flagged rather than silently causing a
  duplicate `SourceEntry` on the next run — the orchestrator's preflight
  step diffs the most recent run report against the registry on startup and
  refuses to auto-process any namespaced key found `ingested` in the report
  but absent from `last_pulled_hashes`, surfacing it as a manual-reconcile
  item instead.
- `sync-treatment` itself failing (lock conflict, dependency-map missing):
  matches its own existing exit codes (1 for `LockConflictError`/
  `LockUnrecoverableError`, 2 for skipped topics/cursor-write failure). The
  ingest run's own facts have already landed regardless — sync-treatment
  failure is logged in the run report as a distinct `sync_treatment_status`
  field, not conflated with ingest success/failure.

## 7. Testing

**NotebookLM adapter fixtures** (the new integration boundary — mocked at
the MCP tool-call layer, response shapes taken verbatim from the live calls
in §0/§3.1, not invented):

- `source_list_drive` fixture: the real CIC-KB shape (`drive_sources: []`,
  `other_sources` with two same-titled entries) — proves the
  basename-collision path (existing `routeIntake.ts` staging logic) fires
  correctly for NotebookLM-sourced duplicate titles, not a new dedup
  mechanism.
- `source_get_content` fixture: real shape incl. `char_count`/`source_type`
  fields that are recorded but not branched on, plus a synthetic empty-
  `content` variant to drive the quarantine path.
- `note(action="list")` fixture: real 5-note CIC-KB shape, confirming
  `content` (not `preview`) is what gets staged.
- MCP error payload fixture (timeout / non-`"success"` status / thrown
  exception from the tool call) for each of the three adapter calls above —
  each must land in `quarantined`, not crash the run.
- YouTube-source fixture (`type: "youtube"` from `source_list_drive`, once
  confirmed against the live `Willow Run Videos` notebook during
  implementation) — drives the derived-provenance marker and
  `--origin notebooklm-derived` path.
- **Command-level orchestration fixture**: a fake `trm` CLI (child-process
  stub) asserting the exact argv built for each of `triage-intake`,
  `route-intake --apply`, `ingest ... --type notebooklm-source`, `extract`,
  and `sync-treatment --narrative-root ...` — catches argument-shape drift
  if trm's own CLI contract changes later, without needing a real vault.

**Pipeline behavior:**

- **Change detection**: pulling the same source content twice produces zero
  new files in `intake/`; pulling with different content for the same
  `source_id` produces a second file and updates
  `last_pulled_hashes["source:<id>"]`.
- **Quarantine**: an item with empty content is written to `quarantined`,
  not `intake/`; re-running with the same empty content does not re-log it
  a second time (only `attempts`/`last_seen_at` change); the same item
  returning real content on a later run clears its `quarantined` entry and
  proceeds as new.
- **Run-report/registry reconciliation**: an item present as `ingested` in
  the latest run report but absent from the registry's `last_pulled_hashes`
  (simulating a crash between per-item ingest and per-item registry flush)
  is flagged by the orchestrator's preflight and not silently re-ingested.
- **Note pulls**: notes (not just sources) go through the same
  hash-dedup/staging path; a new note produces a staged file, an unchanged
  note does not.
- **Partial notebook failure**: one notebook in a multi-notebook sweep
  raising an auth error does not abort the sweep for the others, and does
  not update that notebook's registry timestamps.
- **`route-intake` unsorted path**: a pulled item whose slugified filename
  matches no topic keyword lands `unsorted` (not staged, not ingested),
  matching current behavior for any other unmatched intake file.
- **Path containment**: a malicious/malformed source title cannot produce a
  slugified filename that escapes `intake/notebooklm/<notebook-slug>/`
  (reuses `resolvePhysicalPath`'s existing root-escape guard in
  `routeIntake.ts` — no new guard invented, just confirms it still fires for
  these paths).
- **Malformed MCP responses**: `source_get_content`/`note(action=list)`
  returning an error or unexpected shape is treated as a skip for that item,
  not a thrown/uncaught exception that aborts the whole run.
- **Registry atomicity**: registry writes use the same `writeFileAtomic`
  pattern already used elsewhere in trm (`atomicWrite.ts`) — a crash
  mid-write leaves the previous valid registry JSON intact, never a
  truncated/corrupt file.
- **Concurrent runs**: two `trm ingest-notebooklm` invocations for different
  notebooks writing into the same topic's `intake-manifest.json`/
  `route-intake` lock (`intake-routing.lock`) serialize correctly — reuses
  the existing `acquireLock`/`releaseLock` mechanism already in
  `routeIntake.ts`, not a new lock.
- **Mining dedup**: two mining runs with identical answers produce zero new
  doc rows and zero new TODOS entries; a changed answer for the same
  question produces exactly one new row (old row retained, not overwritten).
- **TODOS idempotency**: re-running mining after a TODOS entry was manually
  marked Completed does not re-add it as Open (compound-key scan covers both
  sections, not just Open).
- **YouTube derived provenance**: a YouTube-backed source's staged file
  carries the `<!-- provenance: derived -->` marker and its resulting
  `SourceEntry.origin` is `notebooklm-derived`, distinguishable from a
  primary-text source's `notebooklm` origin in `sources/metadata.json`.

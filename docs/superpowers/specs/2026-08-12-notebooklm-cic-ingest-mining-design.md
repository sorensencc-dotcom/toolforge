# NotebookLM → CIC/trm Ingest & Reverse-Mining Design

**Status:** APPROVED (rev 2 — corrected against live trm source, see §0)
**Date:** 2026-08-12
**Target Path:** `docs/superpowers/specs/2026-08-12-notebooklm-cic-ingest-mining-design.md`
**Governing Subsystems:** `trm`, `charlie-deep-research`, `notebooklm-mcp`

## 0. Revision Note

Rev 1 invented a raw-Markdown staging format, a content-based classifier, and a
new atomic/synthesis triage classifier — none of which exist in trm. Rev 2 was
rewritten after reading `trm/src/core/{rawSource,sourceIngest,topicRouting,
intakeManifest}.ts` and `trm/src/cli/commands/{routeIntake,ingest,extract,
syncTreatment}.ts` directly. This pipeline does **not** introduce any new
staging format, classifier, or triage schema — it drives trm's existing
intake→route→ingest→extract→sync-treatment chain unchanged, adding only a
NotebookLM-specific pull step at the front and a mining step alongside it.

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

`last_pulled_hashes` maps `source_id|note_id -> sha256(content)`. This is the
change-detection mechanism (see §3.2) — it replaces the rev-1 approach of
diffing raw id arrays, which only detects new items, not edited ones. No
notebook is added or removed from this file automatically; adding a sixth CIC
notebook later is a manual one-line edit here, same as today's trm topic
registration is manual (`trm create topics/charlie/<topic>`).

## 3. Forward Ingest Pipeline

New command: `trm ingest-notebooklm <notebook-id>`. Drives trm's existing CLI
commands as subprocesses/library calls in sequence — it does not reimplement
any of their logic.

### 3.1 Pull

For each notebook in the registry (or the one given on the command line):

- `source_list_drive` + `source_get_content` per source.
- `note(action=list)` for all notebook notes — curated chat-note discoveries live here.
- For YouTube-backed sources, `source_get_content` returns NotebookLM's derived summary, not a raw transcript. This is written into the physical file with a `<!-- provenance: derived -->` marker as the first line, and the SourceEntry's `origin` field (§3.4) is set to `notebooklm-derived` instead of `notebooklm` so extraction/lineage can distinguish primary from derived text at a glance without a schema change.

### 3.2 Change detection

For each pulled item, compute `sha256(content)`. Compare against
`registry.notebooks[i].last_pulled_hashes[item_id]`:

- Missing key → new item, proceeds.
- Different hash → changed item, proceeds (re-processed as if new; trm has no
  "supersede a fact" operation, so an edited NotebookLM source produces a
  second physical file rather than mutating history — consistent with how
  trm treats all sources as immutable once ingested).
- Same hash → skipped, not re-pulled into `intake/`.

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

### 3.4 Drive existing pipeline, unmodified

1. `trm triage-intake --dir intake/notebooklm/<notebook-slug>` — hashes files, classifies `kind: 'text'` (zero-cost, `.md` is in `TEXT_EXTENSIONS`), writes `intake-manifest.json` entries with `status: 'done'`.
2. `trm route-intake --apply` — classifies each manifest entry by path via `classifyPath()`, stages matched entries into `topics/charlie/<topic>/_staging-intake-<runId>/`. Entries with `ambiguous: true` or no keyword match get `topic: null` and are **not** staged — same "lands unsorted, needs manual reroute" behavior as any other unsorted intake today. No new handling introduced.
3. For each staged file, `trm ingest <topicPath> --file <stagedPath> --type <inferred> --title <source_title> --origin notebooklm|notebooklm-derived --url <notebook_source_url or notebook note URL>` — this is the real `addSource` + `writeRawEnvelope` call (`kind: 'text'`), identical to how any other text source is ingested today. `--type` follows whatever value the existing `--type` convention uses for text sources in this vault (not introduced here).
4. `trm extract <topicPath>` — unmodified. Produces `extracts/extract.json` (`Fact[]`) and `extracts/summary.md` exactly as it does for any other source. **There is no separate atomic-vs-synthesis split to build**: `extract.json` already holds the atomic facts, and `summary.md` already holds the runner's narrative synthesis for that source. Both artifacts already exist per the current extraction contract — this pipeline does not add a new one.

### 3.5 Cross-repo write: reuse `sync-treatment`, don't invent one

`trm sync-treatment` already owns the vault→`charlie-deep-research` boundary:
lock file (`.sync-treatment.lock`), atomic report write, per-topic cursor
(`.sync-cursor.json`), and fact-vs-dependency-map matching
(`CIC_SOURCING_DEPENDENCY_MAP_v1.json` in `narrativeRoot/treatment/`). This
pipeline does not write into `charlie-deep-research` directly and does not
introduce a second cross-repo write path. After `trm extract` runs for any
topic touched by this ingest, the existing `trm sync-treatment` command is
run (same as it would be after any other ingest) and its report — not a new
draft-block mechanism — is the review surface for treatment updates. This
resolves the "who owns cross-repo writes" question by not creating a second
owner.

### 3.6 Registry update

On success, update `last_pulled_hashes[item_id]`, `last_seen_note_ids`,
`last_ingested_at` in the registry entry for that notebook. Written after
step 3.4 completes for all items in the run — a mid-run failure (e.g.
`route-intake` preflight fails on a missing topic node) leaves the registry
untouched, so the next run retries the same items rather than silently
skipping them as "already seen."

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
- Malformed/empty NotebookLM content (`source_get_content` returns empty or
  an error payload): item is skipped, not written to `intake/`, logged to
  the run's stderr output — never staged as an empty file that would produce
  a hollow fact.
- Registry write itself failing mid-run (disk full, permissions): the
  ingest/mining side effects that already landed (staged files, extract.json,
  doc/TODOS rows) are not rolled back — same "effects committed, tracking
  state didn't update" trade-off `sync-treatment` already accepts for its own
  cursor writes (see its `cursorWriteFailed` / exit-code-2 path).

## 7. Testing

- **Change detection**: pulling the same source content twice produces zero
  new files in `intake/`; pulling with different content for the same
  `source_id` produces a second file and updates
  `last_pulled_hashes[source_id]`.
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

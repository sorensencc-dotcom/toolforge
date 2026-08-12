# NotebookLM → CIC/trm Ingest & Reverse-Mining Design

**Status:** APPROVED
**Date:** 2026-08-12
**Target Path:** `docs/superpowers/specs/2026-08-12-notebooklm-cic-ingest-mining-design.md`
**Governing Subsystems:** `trm`, `charlie-deep-research`, `notebooklm-mcp`

## 1. Goal

Two complementary pipelines around the CIC-relevant NotebookLM notebooks:

1. **Forward ingest** — pull research discoveries (chat notes + source content) out of NotebookLM notebooks into trm facts and/or `charlie-deep-research` treatment drafts.
2. **Reverse mining** — query notebooks with a fixed question set to surface open questions, under-sourced claims, and adjacent research gaps, so those can drive what gets researched next.

Loop between the two is **manual by design**: mining output lands in a doc + TODOS.md; a human decides which questions to chase further in NotebookLM. No auto-triggered `research_start`/`research_import` calls.

## 2. Scope & Registry

Only CIC-relevant notebooks participate, registered manually (not auto-discovered from the full `notebook_list`, which also contains unrelated personal notebooks — bourbon, VS Code, recipes, etc).

At design time, live registry candidates (from `notebook_list`):

| Notebook | id | sources |
|---|---|---|
| CIC-KB | `679b8bab-2d87-42cb-a726-6dc54c83acc2` | 2 |
| CIC - Daily Research | `1b4861a3-931f-4632-8fc1-343a8dd37df8` | 305 |
| Willow Run Videos | `ef78168d-b7b9-4952-8e0f-fcb353a21181` | 22 (YouTube) |
| Cast Iron Charlie - Research Logs | `b8bc161d-495f-42f9-a7d1-ed8692141f6b` | 2 |
| The Sorensen Photographic Archive: Industrial Giants at Willow Run | `fd0e0e4e-6890-4fb9-89bf-b9e568295e7a` | 1 |

New file: `trm/config/notebooklm-registry.json`

```json
{
  "version": 1,
  "notebooks": [
    {
      "notebook_id": "1b4861a3-931f-4632-8fc1-343a8dd37df8",
      "title": "CIC - Daily Research",
      "url": "https://notebooklm.google.com/notebook/1b4861a3-931f-4632-8fc1-343a8dd37df8",
      "topic": null,
      "last_seen_source_ids": [],
      "last_seen_note_ids": [],
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answers_hash": {}
    }
  ]
}
```

`topic: null` means multi-topic — per-source classification runs at ingest time instead of a fixed notebook→topic mapping. This covers "CIC - Daily Research" (305 sources spanning many subjects). Single-focus notebooks may set `topic` directly to skip classification.

## 3. Forward Ingest Pipeline

New command: `trm ingest-notebooklm <notebook-id>`

1. **Diff:** compare live `source_list_drive` / `note(action=list)` results against registry's `last_seen_source_ids`/`last_seen_note_ids`. Only new/changed items proceed.
2. **Pull content:**
   - `source_get_content` per new source (doc/PDF text).
   - For YouTube sources: `source_get_content` returns NotebookLM's derived summary, not a raw transcript — staged with `provenance: derived`, not `primary`.
   - All notebook notes via `note(action=list)` — your curated chat-note discoveries live here.
3. **Stage:** write each as raw markdown under trm's existing raw-intake convention. Frontmatter:
   ```yaml
   source: notebooklm
   notebook_id: <id>
   notebook_title: <title>
   source_id: <id>
   source_title: <title>
   source_url: <url or null for notes>
   provenance: primary|derived
   retrieved_at: <ISO8601>
   ```
4. **Classify:** run existing `trm/src/core/topicRouting.ts` against staged content. Auto-assign on high confidence; flag low-confidence for manual pick — same behavior as current raw-intake flow.
5. **Extract:** run trm's extraction pipeline → facts with lineage citing `notebook_id:source_id` as the provenance source (in place of a vault file path).
6. **Triage split** (per-discovery, not per-notebook):
   - Atomic sourced claims (dates, names, measurable facts) → merged into trm facts same as any extraction run.
   - Interpretive/synthesis content (NotebookLM analysis, narrative framing, thematic synthesis) → written as a "needs review" draft block appended to the matching `charlie-deep-research` treatment file for that topic. Never auto-merged into finished treatment prose — sits pending your accept/edit/reject.
7. **Commit:** trm-vault committed after the run completes (existing convention — commit per ingest run, not batched).
8. **Update registry:** `last_seen_source_ids`, `last_seen_note_ids`, `last_ingested_at`.

## 4. Reverse-Mining Pipeline

New command: `trm mine-notebooklm <notebook-id>` (on-demand) + scheduled weekly sweep across all registry notebooks.

Fixed, versioned question set — `trm/config/mining-questions.json`:

```json
{
  "version": 1,
  "questions": [
    "What open questions or unresolved contradictions exist across these sources?",
    "What claims are asserted but single-sourced or under-corroborated?",
    "What adjacent topics do these sources point to that aren't covered yet?",
    "What follow-up research would most strengthen current findings?"
  ]
}
```

Run each question via `notebook_query` against the notebook.

**Diffing:** hash each answer; compare to `last_mined_answers_hash[question]` in the registry entry. Only surface new/changed answers per run — avoids re-flooding output when nothing changed.

**Output (both land, every run with new content):**
- `trm/<topic>/open-questions.md` for single-topic notebooks, or `trm/research-gaps/<notebook-slug>.md` for multi-topic notebooks (e.g. Daily Research). Table columns: Question | Answer excerpt | Notebook source | First-seen date.
- Answers matching an urgency heuristic ("needs verification", "recommend investigating", "no source found") also appended as new entries to `TODOS.md` Open section.

**Loop closure is manual.** No question here auto-triggers `research_start`/`research_import`. You read the doc/TODOS entries and decide which to chase; chasing means manually invoking NotebookLM research tools yourself.

## 5. Scheduling Infra

Windows Task Scheduler wrapper, matching the existing kb-sync pattern (`schedule-task-wrapper-KB-Sync-*.ps1`):

- New: `schedule-task-wrapper-TRM-Notebooklm-Mine.ps1` — weekly sweep, all registry notebooks.
- Ingest (`trm ingest-notebooklm`) stays on-demand only; not scheduled at this phase — discoveries are sourced by you manually finding them in a notebook, not a passive drip.

Not using Claude Code's cloud `schedule`/`CronCreate` skill: `notebooklm-mcp` is a local MCP server bound to this machine's browser auth session; a cloud-run routine cannot reach it.

Weekly cadence for mining (not daily) — research corpora don't churn like calendar/email; daily sweeps on a 305-source notebook would add noise and cost without proportional signal.

## 6. Error Handling

- Notebook unreachable / auth expired (`nlm login` needed): run aborts for that notebook only, others in the sweep continue, registry `last_ingested_at`/`last_mined_at` left untouched for the failed one (retried next run).
- Low-confidence topic classification: same manual-pick UX as today's raw-intake flow — no new pattern introduced.
- Malformed/empty source content: skipped, logged, not written as an empty fact/treatment block.

## 7. Testing

- Registry diff logic: unit test that re-running ingest with an unchanged notebook produces zero new staged files.
- Mining hash-diff: unit test that identical answers across two runs produce zero doc/TODOS writes.
- Triage split: fixture with one atomic-claim sentence and one synthesis-paragraph input, assert correct routing to fact vs treatment draft block.

# TRM Reporting Engine v1 — Design

**Date:** 2026-07-18
**Status:** Design — pending user spec review

## Goal

Add a `trm report <path>` command that generates a Cast Iron Charlie–styled HTML research report from a vault topic node's existing data (`topic.json`, `sources/`, `extracts/extract.json`). Reuses the CIC dossier CSS/layout from `C:\CIC_MEDIA_LIBRARY\CIC\reports\report_full_latest.html` so reporting isn't reinvented per-project.

## Non-Goals (explicitly out of v1)

- Entity graph, relationship map, timeline, gap analysis — trm's `extract.json` facts are flat (`{id, text, source_id, confidence, categories}`); no entity/date/relationship extraction exists yet. These sections require new extraction work, not reporting work, and are deferred.
- PDF, Word, PowerPoint output — HTML only.
- Executive-summary / research-brief templates — full report only.
- Real pluggable theming — CIC CSS is hardcoded. A `theme` field is threaded through the bundle and render function signature as a stub so a second theme can be added later without re-plumbing the pipeline, but only `"cic"` is implemented; any other value is a hard error.

## Architecture

Two-stage pipeline inside `trm` (`C:\dev\trm`), wired as one new CLI command.

### Stage 1 — Export (`src/reporting/exportBundle.ts`)

Reads a vault topic node and produces a normalized, versioned JSON bundle. This bundle is the *only* contract the render stage depends on — decouples rendering from trm's internal file layout, so a future non-trm data producer could feed the same renderer without touching it.

```typescript
export interface ReportBundle {
  version: string;          // "1.0.0" — bump on any breaking shape change
  topicPath: string;        // "charlie/cuba"
  topicSlug: string;        // "cuba"
  generatedAt: string;      // ISO 8601
  sourceCount: number;      // top-level, mirrors stats.sourceCount
  factCount: number;        // top-level, mirrors stats.factCount
  stats: {
    sourceCount: number;
    factCount: number;
  };
  facts: Array<{
    text: string;
    sourceId: string;
    confidence: number;
    categories: string[];
  }>;
  sources: Array<{
    id: string;
    type: string;
    title: string;
    origin: string;
    url: string;
    addedAt: string;
  }>;
  theme: string;            // "cic" in v1; other values rejected by renderer
}

export function exportBundle(root: string, topicPath: string, theme?: string): ReportBundle;
```

### Stage 2 — Render (`src/reporting/renderHtml.ts`)

Takes a `ReportBundle`, injects it into the CIC HTML template via plain template-literal string substitution (no templating library — matches trm's existing lean dependency footprint of `commander` + `ajv`).

```typescript
export function renderHtml(bundle: ReportBundle): string; // throws if bundle.theme !== "cic"
```

**Sections rendered (v1):**
- **Cover** — topic name, generated date.
- **Stats bar** — source count, fact count (real counts; not the richer 6-metric version from the sample, since entities/relationships/timeline/gaps don't exist in trm's data).
- **Narrative** — blank/manual-fill placeholder paragraph (not auto-generated from facts).
- **Evidence register** — one entry per `sources[]` item, formatted as a citation line.
- **Facts list** — facts grouped by `categories`, replacing the entity grid/timeline from the sample report (the honest v1 substitute for data trm doesn't have).

**Sections NOT rendered:** entity grid, relationship map, chronological timeline, gap analysis, archive-sources-queried (all depend on data trm doesn't extract yet).

### CLI wiring (`src/cli/index.ts`)

```
trm report <path> [--theme <name>]
```

- Calls `exportBundle(root, path, opts.theme)`, then `renderHtml(bundle)`.
- Writes both files to `<vault-root>/reports/<topicSlug>-<timestamp>.json` and `.html`.
- Prints both output paths to stdout.
- `--theme` defaults to `"cic"`; any other value produces a clear CLI error (not a silent fallback).

## Output Location

`trm-vault/reports/` at vault root (not inside the topic node) — one place to find all generated reports across topics. Bundle (`.json`) is kept alongside the rendered `.html` so a report can be re-rendered from the bundle without re-running export.

## Data Flow

```
vault topic node (topic.json, sources/, extracts/extract.json)
        |
        v
  exportBundle()  →  ReportBundle (versioned JSON)
        |
        v
  renderHtml()    →  HTML string (CIC theme)
        |
        v
  trm-vault/reports/<slug>-<ts>.json
  trm-vault/reports/<slug>-<ts>.html
```

## Error Handling

- `exportBundle` throws if the topic node doesn't exist (reuses existing `topicNode`/`paths` error conventions already in `src/core`).
- `renderHtml` throws immediately on unsupported `theme` — no silent CIC fallback, since a wrong report style shipped to a client is worse than a crash.
- No special handling for empty `facts`/`sources` arrays beyond rendering empty sections cleanly (tested explicitly, not treated as an error).

## Testing

- **Unit — `exportBundle`:** given a fixture topic dir (mirroring the tmpdir pattern already used in `tests/core/rootSafety.test.ts` and the existing `run*` command tests), produces a bundle with correct shape, correct counts, correct slug/path derivation.
- **Unit — `renderHtml`:** given a hand-built bundle, output HTML contains expected data (topic name, fact text, source citations); throws on `theme !== "cic"`; renders cleanly with empty `facts`/`sources`.
- **Live smoke test:** run `trm report charlie/cuba` against the real vault (`C:\Users\soren\trm-vault`) as final proof — same pattern as the `assertSafeRoot` live verification already done for this repo. Confirms the guardrail (`assertSafeRoot`) still fires correctly for this new command too, since it's wired through the same `cli/index.ts` entrypoint.

## Spec Self-Review

- **Placeholder scan:** none — all fields and behaviors are concretely specified; "narrative" section is explicitly a manual-fill placeholder by design, not a TBD.
- **Internal consistency:** bundle schema, render sections, and CLI behavior all agree; no section references data not present in the bundle.
- **Scope check:** single cohesive unit (export + render + one CLI command); no decomposition needed.
- **Ambiguity check:** theme handling made explicit (hard error on non-"cic"); output location made explicit (vault-root `reports/`, not per-topic); "facts list" as entity-grid/timeline substitute made explicit rather than left as an implied gap.

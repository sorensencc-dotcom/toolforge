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
  topicSlug: string;        // "charlie-cuba" — full path flattened, NOT just the leaf
                             // (leaf-only slugs collide across different parents; see
                             // Refinement 3 below)
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

**Defensive rendering — HTML escaping:** because this uses native template literals (no auto-escaping templating library), every string field pulled from bundle data (`facts[].text`, `sources[].title`, `sources[].url`, etc.) is passed through a zero-dependency `escapeHtml()` helper defined in `renderHtml.ts` before injection, converting `&`, `<`, `>`, `"`, `'` to their HTML entities. Prevents markup corruption or injection from raw vault text (e.g. a fact containing a literal `<` or `&`).

**Defensive rendering — orphaned source references:** a fact's `sourceId` is looked up against `bundle.sources[]` when rendering evidence citations. If no matching source exists, the renderer emits the fallback label `[Unknown Source]` instead of throwing or rendering `undefined`. This is a renderer-level guard, not an export-stage validation — `exportBundle` does not reject topic nodes with dangling `source_id` references (`trm validate` already owns that integrity check via its lineage chain validation).

**Sections rendered (v1):**
- **Cover** — topic name, generated date.
- **Stats bar** — source count, fact count (real counts; not the richer 6-metric version from the sample, since entities/relationships/timeline/gaps don't exist in trm's data).
- **Narrative** — blank/manual-fill placeholder paragraph (not auto-generated from facts).
- **Evidence register** — one entry per `sources[]` item, formatted as a citation line.
- **Facts list** — facts grouped by category, replacing the entity grid/timeline from the sample report (the honest v1 substitute for data trm doesn't have). **Grouping rule:** a fact is grouped under its *first* declared `categories[0]` entry only — never duplicated across multiple category sections. A fact with an empty `categories` array is grouped under a synthetic `"Uncategorized"` section.

**Sections NOT rendered:** entity grid, relationship map, chronological timeline, gap analysis, archive-sources-queried (all depend on data trm doesn't extract yet).

### CLI wiring (`src/cli/index.ts`)

```text
trm report <path> [--theme <name>]
```

- Validates `--theme` at the CLI action handler, *before* calling `exportBundle` — rejects any value other than `"cic"` immediately with a clear error. This is a duplicate of `renderHtml`'s own check, deliberately: it fails fast before any file I/O (export stage) runs, rather than doing the read/export work only to discard it on a render-time throw.
- Calls `exportBundle(root, path, opts.theme)`, then `renderHtml(bundle)`.
- Writes both files to `<vault-root>/reports/<topicSlug>-<timestamp>.json` and `.html`, where `topicSlug` is the full topic path with `/` replaced by `-` (e.g. `charlie/cuba` → `charlie-cuba`) — never a nested path, so `reports/` stays a single flat directory regardless of topic nesting depth. `<timestamp>` is `Date.now()` (milliseconds since epoch) plus a 4-character random suffix (e.g. `crypto.randomBytes(2).toString('hex')`) — guards against filename collisions when `trm report` runs more than once per millisecond in scripted/batch use.
- Creates the `reports/` directory recursively (`fs.mkdirSync(reportsDir, { recursive: true })`) before writing, since it won't exist on a fresh vault.
- Prints both output paths to stdout.
- `--theme` defaults to `"cic"`; any other value produces a clear CLI error (not a silent fallback).

## Output Location

`trm-vault/reports/` at vault root (not inside the topic node) — one place to find all generated reports across topics. Bundle (`.json`) is kept alongside the rendered `.html` so a report can be re-rendered from the bundle without re-running export.

## Data Flow

```text
CLI: --theme validated (fail fast if not "cic")
        |
        v
vault topic node (topic.json, sources/, extracts/extract.json)
        |
        v
  exportBundle()  →  ReportBundle (versioned JSON)
        |
        v
  renderHtml()    →  HTML string (CIC theme)   ── throws if bundle.theme !== "cic" (belt-and-suspenders)
        |
        v
  trm-vault/reports/<slug>-<ts>.json   (ts = Date.now() + random suffix)
  trm-vault/reports/<slug>-<ts>.html
```

## Error Handling

- `exportBundle` throws if the topic node doesn't exist — it calls `readTopicMeta(root, topicPath)` (`src/core/topicNode.ts:11`), which lets `fs.readFileSync`'s native `ENOENT` propagate rather than wrapping it in a custom message. No new error-handling code needed here; this is existing behavior being reused as-is.
- `renderHtml` throws immediately on unsupported `theme` — no silent CIC fallback, since a wrong report style shipped to a client is worse than a crash.
- No special handling for empty `facts`/`sources` arrays beyond rendering empty sections cleanly (tested explicitly, not treated as an error).

## Testing

- **Unit — `exportBundle`:** given a fixture topic dir (mirroring the tmpdir pattern already used in `tests/core/rootSafety.test.ts` and the existing `run*` command tests), produces a bundle with correct shape and counts, `topicPath` passed through unchanged, and `topicSlug` correctly transformed from it (see next line for the nested-path case).
- **Unit — `renderHtml`:** given a hand-built bundle, output HTML contains expected data (topic name, fact text, source citations); throws on `theme !== "cic"`; renders cleanly with empty `facts`/`sources`; escapes `<`, `>`, `&`, `"`, `'` in injected fact/source text rather than passing them through raw; groups a multi-category fact under only its first category, never duplicated; groups a no-category fact under `"Uncategorized"`; renders `[Unknown Source]` for a fact whose `sourceId` has no match in `bundle.sources[]`.
- **Unit — `exportBundle`:** slug derivation test explicitly covers a nested topic path (`charlie/cuba` → `charlie-cuba`) to confirm flattening, not just a single-segment path.
- **Unit — CLI wiring:** `--theme bogus` rejected before `exportBundle` runs (verify via a spy/mock that `exportBundle` is never called); two `trm report` calls in immediate succession produce two distinct filenames (proves the random-suffix collision guard, not just millisecond precision).
- **Live smoke test:** run `trm report charlie/cuba` against the real vault (`C:\Users\soren\trm-vault`) as final proof — same pattern as the `assertSafeRoot` live verification already done for this repo. Confirms the guardrail (`assertSafeRoot`) still fires correctly for this new command too, since it's wired through the same `cli/index.ts` entrypoint.

## Spec Self-Review

- **Placeholder scan:** none — all fields and behaviors are concretely specified; "narrative" section is explicitly a manual-fill placeholder by design, not a TBD.
- **Internal consistency:** bundle schema, render sections, and CLI behavior all agree; no section references data not present in the bundle.
- **Scope check:** single cohesive unit (export + render + one CLI command); no decomposition needed.
- **Ambiguity check:** theme handling made explicit (hard error on non-"cic"); output location made explicit (vault-root `reports/`, not per-topic); "facts list" as entity-grid/timeline substitute made explicit rather than left as an implied gap; fact-to-category cardinality resolved (first category wins, no duplication, `"Uncategorized"` fallback); HTML escaping made explicit (zero-dep `escapeHtml()` helper, applied to all injected strings); slug derivation made explicit (full path flattened with hyphens, not leaf-only, avoiding collisions and nested-directory writes); orphaned `sourceId` references resolved (renderer-level `[Unknown Source]` fallback, not an export-stage validation concern).

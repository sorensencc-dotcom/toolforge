# CIC Tool Surface — Phase 2 Design

Date: 2026-07-16
Status: Approved (design), pending implementation plan

## Context

Phase 1 (`docs/meta/cic-tool-surface-phase1-design.md`) shipped four Toolforge
skills (`cic-ingest-world`, `cic-run-gate`, `cic-repair-pipeline`,
`cic-consolidate-artifacts`) writing to per-tool `cic/artifacts/<kind>/<id>/`
paths. Workspace layout beyond that was explicitly deferred.

This spec covers **Phase 2 only**: extending the `/cic/` workspace with
`lineage/` and `reports/` index directories, and fixing a path-anchoring gap
found in `_cic-shared` while reviewing Phase 1 code. `agents/` and `configs/`
(also named in the original 5-phase plan's tree) remain deferred — nothing
consumes them yet (`agents/` waits on Grok Build wiring, `configs/` waits on
orchestration flows, neither spec'd).

## Verified starting state

- `_cic-shared/src/artifactPaths.ts`: `artifactPaths(kind, id)` resolves
  `path.join(process.cwd(), 'cic', 'artifacts', kind, id)` — anchored to
  whatever directory the skill process happens to run from, not the repo
  root. Works today because Phase 1 tests/usage always ran from repo root;
  fragile if a skill is ever invoked from elsewhere (e.g. Toolforge runtime
  cwd).
- `cic-run-gate/src/index.ts`: writes real `report.json` + `result.json`
  under `cic/artifacts/gates/<runId>/`. `reportPath` and `artifactsPath` in
  its output both point inside that same dir — no separate `reports/` tree
  exists.
- `cic-ingest-world/src/index.ts`: stub. Its output has a `lineageRef` field
  (`lineage:ingest:<sourceId>:<runId>`) but this is just a string tag inside
  `result.json` — no `lineage/` tree exists to hold it.
- `cic-repair-pipeline`, `cic-consolidate-artifacts`: stubs. Neither produces
  content that maps naturally to "lineage" or "report" — repair emits a
  patch set, consolidate emits a bundle.
- No skill or test reads `cic/lineage/` or `cic/reports/` today; they don't
  exist on disk anywhere in the repo.

## Decisions

1. **`lineage/` and `reports/` are thin cross-reference indexes, not a
   second copy of artifact content.** `artifacts/<kind>/<id>/` stays the
   single source of truth (unchanged). Each index entry is a small JSON
   pointer + summary referencing the real artifact path. Avoids dual-write
   drift between two copies of the same data.
2. **Only `cic-run-gate` and `cic-ingest-world` write index entries in
   Phase 2.** `cic-run-gate` already produces a real report — trivial,
   real-content addition. `cic-ingest-world` already fabricates a
   `lineageRef` — promoting it from a string field to a real (stub-tagged)
   index entry matches Phase 1's existing stub convention. `cic-repair-pipeline`
   and `cic-consolidate-artifacts` are skipped: forcing a report/lineage
   entry out of a patch-set or bundle stub would be inventing structure
   with no real backing.
3. **Fix `artifactPaths()` to anchor at repo root, not `process.cwd()`.**
   Add `findRepoRoot(startDir)` to `_cic-shared`: walks up from a start dir
   (default `__dirname` of the caller) to the nearest ancestor containing
   `.git`, memoized per-process. `artifactPaths(kind, id, repoRoot?)` takes
   an optional override (for tests) and defaults to `findRepoRoot(__dirname)`
   resolved relative to `_cic-shared` itself, so behavior is identical
   regardless of the invoking skill's cwd. Bundled into this phase because
   it's a small, correctness-relevant fix directly adjacent to the
   directories being added — not because it blocked Phase 1.
4. **`agents/` and `configs/` are not created in Phase 2.** No consumer, no
   spec. Creating empty directories for a plan that hasn't been written yet
   is speculative structure; they'll be added when the phase that needs them
   is spec'd (Grok Build wiring, orchestration flows respectively).
5. **No new tools.** Phase 2 only retrofits the 4 existing skills' write
   paths and `_cic-shared` helpers. A read/list tool over `cic/` is
   explicitly out of scope — nothing needs to query the tree yet.

## Tree shape

```
cic/
  artifacts/<kind>/<id>/...        (unchanged — source of truth)
  lineage/<kind>/<id>.json         (new — index entry)
  reports/<kind>/<id>.json         (new — index entry)
```

`kind` values in Phase 2: `gates` (reports only), `ingest` (lineage only).
`repair` and `consolidate` continue writing only to `artifacts/`.

## `_cic-shared` additions

```ts
// findRepoRoot.ts
export function findRepoRoot(startDir: string): string
// walks up from startDir; first ancestor containing .git wins; memoized

// lineagePaths.ts / reportPaths.ts (mirror artifactPaths.ts)
export function lineagePaths(kind: string, id: string, repoRoot?: string): { dir: string; file: string }
export function reportPaths(kind: string, id: string, repoRoot?: string): { dir: string; file: string }

// writeLineageEntry.ts / writeReportEntry.ts (mirror writeResultJson.ts)
export async function writeLineageEntry(kind: string, id: string, payload: Record<string, unknown>): Promise<string>
export async function writeReportEntry(kind: string, id: string, payload: Record<string, unknown>): Promise<string>
```

`artifactPaths(kind, id, repoRoot?)` signature gains the optional third
param; existing callers (all 4 skills) are unaffected since it's optional
and defaults to the corrected repo-root resolution.

## Per-skill changes

### `cic-run-gate`
After the existing `report.json` write, add:
```ts
await writeReportEntry('gates', runId, {
  gateId: input.gateId, status: payload.status, reportPath, timestamp,
});
```

### `cic-ingest-world`
Replace the bare `lineageRef` string construction with a real index write:
```ts
await writeLineageEntry('ingest', runId, {
  lineageRef, sourceId: input.sourceId, status: 'stub', timestamp,
});
```
`lineageRef` field stays in the skill's own `result.json` output (unchanged
output contract) — the index write is additive.

### `cic-repair-pipeline`, `cic-consolidate-artifacts`
No changes.

## Testing

- `_cic-shared/tests/`: `findRepoRoot` (finds `.git` from nested dir, throws
  or falls back sanely if none found within a bounded walk), `lineagePaths`/
  `reportPaths` (path shape), `writeLineageEntry`/`writeReportEntry`
  (write-then-read-back round trip, mirrors existing `writeResultJson` test).
- `cic-run-gate/tests/skill.test.ts`: assert `cic/reports/gates/<runId>.json`
  exists after `main()` with expected `{gateId, status, reportPath}` shape.
- `cic-ingest-world/tests/skill.test.ts`: assert
  `cic/lineage/ingest/<runId>.json` exists with `{lineageRef, sourceId,
  status:'stub'}` shape.
- No changes needed to `cic-repair-pipeline`/`cic-consolidate-artifacts`
  tests.

## Explicitly out of scope (Phase 2)

- `agents/`, `configs/` directories.
- Any new tool (list/query/browse over `cic/`).
- Real content for `cic-repair-pipeline` or `cic-consolidate-artifacts`
  lineage/reports.
- GATE-02/03/05 support (unchanged from Phase 1 — still open gates).
- Orchestration flows, Grok Build wiring, TorqueQuery integration (Phases
  3–5 of the original 5-phase plan, still unspec'd).

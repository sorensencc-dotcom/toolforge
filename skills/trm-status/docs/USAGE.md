# TRM Status — Usage

## Running it

```bash
cd skills/trm-status
npx ts-node src/index.ts C:\Users\soren\trm-vault
```

Or with no arg — defaults to `C:\Users\soren\trm-vault`:

```bash
npx ts-node src/index.ts
```

## Output columns

| Column | Meaning |
|---|---|
| TRM | `<person>/<topic>` path under `topics/` |
| STATE | `STUB` / `STAGING PENDING` / `EXTRACT LAG` / `STALE` / `ACTIVE` |
| COUNTS | `sources / extracts` |
| NEXT STEPS | concrete action, or `—` if none |

## State definitions

- **STUB** — zero sources. Normal for a newly created topic awaiting a research trip or intake. Not an error.
- **STAGING PENDING** — `_staging-batch*` dirs exist AND extracts still lag sources. Real backlog — run `trm ingest-dir`.
- **EXTRACT LAG** — sources ingested but extracts are under 50% of source count. Run the extract pass.
- **STALE** — fully processed but `topic.json.updated_at` is >14 days old. Worth confirming whether the topic is closed or just paused.
- **ACTIVE** — caught up and recently touched. May still carry a cleanup note if fully-processed staging-batch dirs are left on disk (safe to archive/delete, not blocking).

## Creating a new TRM

Adding a new research thread is expected and cheap — create the topic dir with
`trm create <path>`, drop it under the right person, and it'll show up here as
`STUB` until intake starts. This tool doesn't gatekeep new TRMs; it just tells
you what state each one is actually in.

## Extending

- `scanTopicDir` / `deriveStatus` in `src/scanTopic.ts` are pure functions —
  unit tested against synthetic fixture trees in `tests/`, never against the
  real vault.
- Git dirty-check lives in `src/vaultGit.ts`, isolated so it can be swapped or
  mocked without touching the state-derivation logic.
- To add a new state or signal (e.g. crosslink coverage, vision-analysis
  completeness), extend `TrmState` and `deriveStatus` in `scanTopic.ts`, then
  add a fixture-based test alongside the existing ones.

---
title: "TRM Ingest Drive formal state machine and invariant proof"
author: Chris
date: 2026-10-30
id: l-b582f301
scope: repo
status: active
touches:
  - kb-sync/scripts/trm-ingest-drive.mjs
  - kb-sync/specs/trm-ingest-drive/TrmIngestDrive.tla
---

## Decided
- Modeled the asynchronous lifecycle of `scripts/trm-ingest-drive.mjs` into a formal TLA+ specification (`TrmIngestDrive.tla`).
- Formally proved with TLC that:
  1. `LockOnlyHeldDuringWrite`: The file lock is strictly released before returning to `BUFFERED` or transitioning to `COMPLETED` / `REJECTED`.
  2. `NoCorruptIngest`: The pipeline cannot enter `INGESTING` unless validation succeeds, duplicate checks pass, and the lock lease is held.
- Packaged the spec, config, visual view module, and generated Mermaid statechart in `kb-sync/specs/trm-ingest-drive/`.

## Tried and ruled out
- Attempting to bypass the debounce window on mobile inbox files: caused partial reads of Google Doc files during cloud sync.
- Moving files to archive before releasing locks: left stale lockfiles in `_locks/` when process terminates between write and unlink.

## In the code:
- `kb-sync/scripts/trm-ingest-drive.mjs`: implements the 8-state transition lifecycle.
- `kb-sync/specs/trm-ingest-drive/`: contains `TrmIngestDrive.tla`, `.cfg`, `TrmIngestDriveView.mjs`, and `chart.mmd`.

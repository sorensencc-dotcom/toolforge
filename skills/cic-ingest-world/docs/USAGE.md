# cic-ingest-world

Phase 1 stub. Returns a fabricated ingest result — no real ingestion runs.
Real backend deferred until TorqueQuery (`rewrite-docs/services/torquequery/`)
is committed and stable. See `C:\dev\docs\meta\cic-tool-surface-phase1-design.md`.

Paths in output (`artifactsPath`) are relative to repo root
(`<repo-root>/cic/artifacts/...`), not POSIX-absolute `/cic/...` as in the
original plan text — this repo runs on Windows.

## Input
`{ sourceId: string; schemaRef?: string; targetSystem?: string }`

## Output
`{ runId, status: "stub", artifactsPath, lineageRef, timestamp }`

# cic-repair-pipeline

Phase 1 stub. Returns fabricated repair result; no real repair runs.
Paths are relative to repo root (`<repo-root>/cic/artifacts/...`) because this repo runs on Windows.

## Input
`{ pipelineId: string; failureContext?: string }`

## Output
`{ runId, status: "stub", patchSetPath, commands, timestamp }`

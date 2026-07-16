# cic-run-gate

Phase 1 wires `GATE-01` to `CIC-GOVERNANCE/adapters/run_gate_adapter.py`.
Unknown gate IDs return structured `ERROR`; malformed IDs are rejected before spawning.
`scope` and `profile` are accepted but not consumed by current GATE-01 mechanics.
Paths are relative to repo root (`<repo-root>/cic/artifacts/...`) because this repo runs on Windows.

## Input
`{ gateId: string; scope?: string; profile?: string }`

## Output
`{ runId, gateId, status, violations, reportPath, artifactsPath, message, timestamp }`

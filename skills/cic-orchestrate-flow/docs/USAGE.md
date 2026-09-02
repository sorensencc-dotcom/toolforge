# cic-orchestrate-flow

Phase 3. Composes the Phase 1 skills in-process (direct `main()` calls, no
subprocess) into one fixed pipeline: ingest -> gate -> repair (only if gate
did not PASS) -> consolidate (always, bundles every runId produced).

## Input
`{ sourceId: string; gateId?: string; profile?: string }` (`gateId` defaults to `"GATE-01"`)

## Output
`{ flowId, overallStatus: "PASS"|"FAIL"|"ERROR", steps: [{step, runId?, status}], bundleId?, bundlePath?, flowPath, timestamp }`

`overallStatus` mirrors the gate step's status unless any step errors, in
which case it's `"ERROR"` regardless of gate outcome.

Not a configurable/arbitrary flow engine — see
`docs/meta/specs/cic-tool-surface-phase3-design.md` for scope and what's
deferred (config-driven flows, GATE-02/03/05, Grok Build wiring, TorqueQuery).

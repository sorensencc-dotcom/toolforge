# CIC Tool Surface — Phase 3 Design

Date: 2026-07-16
Status: Approved, implemented (commit pending)

## Context

Phase 1 (`cic-tool-surface-phase1-design.md`) shipped four Toolforge skills:
`cic-ingest-world` (stub), `cic-run-gate` (real, GATE-01 only), `cic-repair-pipeline`
(stub), `cic-consolidate-artifacts` (stub). Phase 2 added `cic/lineage/` and
`cic/reports/` index dirs and fixed a `process.cwd()` path-anchoring bug in
`_cic-shared`.

This spec covers **Phase 3 only**: orchestration flows — composing the four
existing skills into a fixed pipeline instead of invoking them one at a time by
hand. `agents/` (Grok Build wiring) and TorqueQuery integration (Phases 4-5)
remain deferred; TorqueQuery is still untracked (`rewrite-docs/services/torquequery`
has no entries in `git ls-files`, verified this session).

Governance note: Phase 1/2 design docs were marked "Approved" directly by the
authoring session. Per `CLAUDE.md` System Message Guardrails ("planning to
execution requires explicit, manual approval typed by the human user"), this
doc stays **Draft** until the user approves it in this conversation — the
implementation plan is not written until then.

## Verified starting state

- All four Phase 1 skills export `async function main(input): Promise<Output>`
  from `src/index.ts`, callable in-process (plain function import, not a
  subprocess) — `cic-run-gate` itself already spawns a Python subprocess
  internally, but the skill-to-skill boundary is a normal TS function call.
- `cic-run-gate` output: `{ runId, gateId, status: PASS|FAIL|ERROR, violations, reportPath, artifactsPath, message, timestamp }`.
  Only `gateId="GATE-01"` runs real mechanics; anything else short-circuits to
  `status: "ERROR"`.
- `cic-ingest-world`, `cic-repair-pipeline` outputs both include `runId` +
  `status: "stub"`. `cic-consolidate-artifacts` takes `runIds: string[]` and
  returns `{ bundleId, status: "stub", bundlePath, timestamp }`.
- `_cic-shared/artifactPaths(kind, id, repoRoot?)` and `writeResultJson(kind, id, payload)`
  are generic over `kind` — no shared-helper change needed to add a `flows` kind.
- No skill in the repo currently calls another skill's `main()`. This is the
  first cross-skill composition.
- GATE-02/03/05 still open (unratified) — unchanged since Phase 1.

## Decisions

1. **One new Toolforge skill: `cic-orchestrate-flow`.** Composes the four
   existing skills by importing and calling their `main()` functions directly
   (in-process), not via subprocess/CLI. Matches "tool calls instead of ad hoc
   shell commands" from the original 5-phase goal.
2. **Fixed flow, not a config-driven DAG.** Input is `{ sourceId: string;
   gateId?: string; profile?: string }` (`gateId` defaults to `"GATE-01"`) —
   no arbitrary step list. A single named pipeline: **ingest → gate → repair
   (only if gate did not PASS) → consolidate (always, bundles every runId
   produced this flow)**. Arbitrary/configurable flows are exactly what
   `configs/` was deferred for in Phase 2 — still no spec, still deferred.
3. **Repair is conditional, consolidate is not.** `cic-repair-pipeline` only
   runs when `cic-run-gate` returns `FAIL` or `ERROR`, called with
   `failureContext` built from the gate's `violations`/`message`. This
   reflects real intent (don't repair a passing gate) using already-existing
   fields — no invented failure-classification logic.
   `cic-consolidate-artifacts` always runs last, over every `runId` the flow
   produced (2 if gate PASSed, 3 if it didn't), so a flow's outcome — pass or
   fail — is always bundled into one retrievable artifact.
4. **No new tool contracts invented.** `cic-orchestrate-flow` calls the
   Phase 1 skills' existing input/output shapes unchanged. It does not add
   parameters to `cic-run-gate`, `cic-ingest-world`, etc.
5. **Flow result written under `kind: "flow"`**, reusing `artifactPaths`/
   `writeResultJson` from `_cic-shared` — no new shared helper needed (Phase 2
   already made these generic over `kind`).
6. **Step failures don't abort the flow.** If `cic-ingest-world` (a stub)
   ever threw, or `cic-run-gate`'s adapter errors, the orchestrator catches
   per-step and records `{ step, status: "ERROR", detail }` in the flow
   result rather than crashing — same "always return a structured result"
   contract Phase 1 set for `cic-run-gate` itself. If ingest fails, gate/repair/
   consolidate are skipped (nothing to gate); the flow result still writes
   with `overallStatus: "ERROR"`.

## Tool contract

```ts
// cic-orchestrate-flow
input:  { sourceId: string; gateId?: string; profile?: string }
output: {
  flowId: string;
  overallStatus: "PASS" | "FAIL" | "ERROR";
  steps: {
    step: "ingest" | "gate" | "repair" | "consolidate";
    runId?: string;      // or bundleId for consolidate
    status: string;      // that step's own status field, or "SKIPPED" / "ERROR"
  }[];
  bundleId?: string;
  bundlePath?: string;
  flowPath: string;      // where this flow's own result.json was written
  timestamp: string;
}
```

`overallStatus` mirrors the gate step's status (`PASS`/`FAIL`) unless any step
threw/errored, in which case it's `"ERROR"` regardless of gate outcome.

## `cic-orchestrate-flow` control flow

```text
main(input):
  flowId = generateRunId()   // same generator, no new ID scheme
  steps = []
  try:
    ingestResult = await ingestMain({ sourceId: input.sourceId })
    steps.push({ step: "ingest", runId: ingestResult.runId, status: ingestResult.status })
  catch (e):
    steps.push({ step: "ingest", status: "ERROR" })
    return writeFlowResult(flowId, steps, "ERROR")   // nothing to gate

  try:
    gateResult = await gateMain({ gateId: input.gateId ?? "GATE-01", profile: input.profile })
    steps.push({ step: "gate", runId: gateResult.runId, status: gateResult.status })
  catch (e):
    steps.push({ step: "gate", status: "ERROR" })
    gateResult = { status: "ERROR", violations: [], message: "gate step threw" }

  if gateResult.status !== "PASS":
    try:
      repairResult = await repairMain({ pipelineId: input.gateId ?? "GATE-01",
        failureContext: gateResult.message })
      steps.push({ step: "repair", runId: repairResult.runId, status: repairResult.status })
    catch (e):
      steps.push({ step: "repair", status: "ERROR" })
  else:
    steps.push({ step: "repair", status: "SKIPPED" })

  runIds = steps.filter(s => s.runId).map(s => s.runId)
  try:
    consolidateResult = await consolidateMain({ runIds, profile: input.profile })
    steps.push({ step: "consolidate", bundleId: consolidateResult.bundleId, status: consolidateResult.status })
  catch (e):
    steps.push({ step: "consolidate", status: "ERROR" })

  overallStatus = steps.some(s => s.status === "ERROR") ? "ERROR" : gateResult.status
  return writeFlowResult(flowId, steps, overallStatus, consolidateResult?.bundleId, consolidateResult?.bundlePath)
```

## Testing

- `cic-orchestrate-flow/tests/skill.test.ts`:
  - happy path: GATE-01 PASS → steps = [ingest, gate PASS, repair SKIPPED,
    consolidate], `overallStatus: "PASS"`.
  - gate FAIL path (force via a non-existent test fixture or mocked adapter
    response): repair step runs with non-empty `failureContext`, consolidate
    still runs, `overallStatus: "FAIL"`.
  - unknown `gateId`: gate step returns `ERROR` (per Phase 1 contract), repair
    still runs (existing "not PASS" branch), `overallStatus: "ERROR"`.
  - ingest throws (mocked): flow short-circuits, `overallStatus: "ERROR"`,
    only one step recorded.
- No changes to existing Phase 1/2 skill tests — their `main()` contracts are
  unchanged.

## Explicitly out of scope (Phase 3)

- Config-driven/arbitrary flows (`configs/` dir) — still no spec.
- `agents/` dir / Grok Build wiring (Phase 4).
- TorqueQuery integration (Phase 5) — still untracked.
- GATE-02/03/05 support — still open, unchanged from Phase 1/2.
- Real `cic-ingest-world`/`cic-repair-pipeline`/`cic-consolidate-artifacts`
  backends — flow composes existing stubs as-is.
- Toolforge marketplace submission for `cic-orchestrate-flow`.

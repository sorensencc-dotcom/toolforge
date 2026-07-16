# CIC Tool Surface — Phase 1 Design

Date: 2026-07-16
Status: Approved (design), pending implementation plan

## Context

Longer-term goal (not this spec): let Grok Build (SpaceXAI's terminal coding agent,
MCP-compatible) orchestrate CIC governance workflows — ingest, gate, repair,
consolidate — as tool calls instead of ad hoc shell commands. That full plan spans
5 phases (tool surface, workspace layout, orchestration flows, governance alignment,
TorqueQuery integration).

This spec covers **Phase 1 only**: the CIC tool surface itself, built as Toolforge
skills, independent of whether/how Grok Build ends up loading them. Later phases
(workspace layout, Grok Build wiring, TorqueQuery integration) are out of scope and
will get their own specs once Phase 1 ships and TorqueQuery (currently untracked in
`rewrite-docs/`) is committed and stable.

Note: exact Grok Build CLI flags / config format referenced in earlier planning
conversation are unverified — Phase 1 defines tool contracts only, not Grok Build
integration syntax.

## Verified starting state

- `CIC-GOVERNANCE/` is real: gate registry, lineage, amendments, ratification
  confirmations. GATE-01 and GATE-04 are CLOSED (ratified). GATE-02, GATE-03,
  GATE-05 are OPEN (`CIC-GOVERNANCE/MANIFEST/gate-implementation-status.md`).
- `CIC-GOVERNANCE/WRAPPERS/governance_runtime.py` implements gate *mechanics*
  (atomic file locks, hash chains, transaction/rollback) as importable Python
  functions — not a callable "run gate X" entrypoint.
- `CIC-GOVERNANCE/tests/test_gate_runtime.py` has `unittest.TestCase` classes per
  gate (`Gate01TransactionTests`, `Gate02PublicationTests`, etc.). No
  `pytest-json-report` or other JSON test-reporter plugin is configured anywhere
  in the repo.
- `rewrite-docs/services/torquequery/` (world-ingestion backend referenced in the
  long-term plan) exists but is untracked — not part of this repo's committed
  history yet.
- Existing Toolforge skill convention (`skills/analyze-token-burn/`,
  `skills/ashfall/`): one skill = one capability, `skill.json` + `manifest.json`
  entry + `src/index.ts` exporting a single `async function main(input): Promise<Output>`
  + `tests/` + `docs/`. Node/TS runtime. No skill in this repo multiplexes
  operations behind one entrypoint.

## Decisions

1. **Scope: Phase 1 only.** Four CIC tools as the deliverable: `cic-ingest-world`,
   `cic-run-gate`, `cic-repair-pipeline`, `cic-consolidate-artifacts`. Workspace
   layout (`/cic/lineage/`, `/cic/reports/`), orchestration flows, and Grok Build
   wiring are explicitly deferred.
2. **Packaging: four separate Toolforge skills**, not one skill with an
   `operation` dispatch field. Matches repo convention exactly; keeps
   versioning, testing, and future marketplace publication per-capability
   instead of bundled.
3. **`cic-run-gate` is the only real (non-stub) tool in Phase 1.** It is scoped
   to `gateId="GATE-01"` only — the sole gate with ratified, closed mechanics.
   Unknown/unclosed gate IDs return a structured `ERROR` result (not a crash);
   this is what makes GATE-02/03/05 support a pure extension later, not a
   redesign.
4. **`cic-run-gate` drives tests via stdlib `unittest`, not pytest.** No JSON
   test-reporter plugin exists in this repo; adding one for one adapter is
   unnecessary. The adapter loads `Gate01TransactionTests` with
   `unittest.TestLoader`, runs it with a custom `TestResult` subclass that
   collects per-test outcomes, and prints one JSON object to stdout. Exit code
   is always 0 on a completed run (including gate FAIL or adapter-level ERROR)
   — non-zero exit is reserved for actual skill/process failure, so the TS
   layer never needs subprocess-crash handling to interpret a domain result.
5. **`cic-ingest-world`, `cic-repair-pipeline`, `cic-consolidate-artifacts` are
   stubs in Phase 1.** No subprocess, no external calls, no TorqueQuery
   dependency (it's untracked). Each fabricates a plausible, clearly-`"stub"`-
   tagged result and writes it via the shared artifact-writer, establishing the
   contract shape now so callers (including a future Grok Build integration)
   can be built against something stable before the real backends exist.
6. **Shared helpers live in `skills/_cic-shared/`**, imported by relative path
   (not a separate package/workspace). Contains: `generateRunId()`,
   `generateBundleId()`, `artifactPaths(kind, runId)`, `writeResultJson(kind,
   runId, payload)`, `validateInput(schema, input)`. Small enough that a new
   packaging convention isn't justified.

## Tool contracts

All four tools share these output fields: `runId` (or `bundleId` for
consolidate), ISO-8601 `timestamp`, and a path field pointing to where the
result JSON was written (`/cic/artifacts/<kind>/<run-id>/result.json`, via
`_cic-shared`).

### `cic-ingest-world` (stub)
```ts
input:  { sourceId: string; schemaRef?: string; targetSystem?: string }
output: { runId: string; status: "stub"; artifactsPath: string; lineageRef: string; timestamp: string }
```

### `cic-run-gate` (real, GATE-01 only)
```ts
input:  { gateId: string; scope?: string; profile?: string }
output: {
  runId: string; gateId: string; status: "PASS" | "FAIL" | "ERROR";
  violations: { testId: string; description: string; outcome: string }[];
  reportPath: string; artifactsPath: string; message: string; timestamp: string;
}
```
`gateId !== "GATE-01"` → `{ status: "ERROR", violations: [], message: "gate not wired", ... }`,
adapter exits 0.

### `cic-repair-pipeline` (stub)
```ts
input:  { pipelineId: string; failureContext?: string }
output: { runId: string; status: "stub"; patchSetPath: string; commands: string[]; timestamp: string }
```

### `cic-consolidate-artifacts` (stub)
```ts
input:  { runIds: string[]; profile?: string }
output: { bundleId: string; status: "stub"; bundlePath: string; timestamp: string }
```

## `cic-run-gate` adapter design

```
skills/cic-run-gate/src/index.ts
  main(input) →
    spawn("python", ["run_gate_adapter.py", gateId, scope ?? "", profile ?? ""],
          { cwd: <repo>/CIC-GOVERNANCE })
    capture stdout (expect exactly one JSON line), stderr (log only)
    parse stdout JSON → map directly to this skill's output shape
    spawn/parse failure (non-JSON stdout, non-zero exit, missing python) →
      status "ERROR", violations: [], message: "adapter invocation failed"
    write result via _cic-shared/writeResultJson("gate", runId, result)
      → /cic/artifacts/gates/<gateId>/<runId>/result.json
```

```python
# CIC-GOVERNANCE/adapters/run_gate_adapter.py
GATE_HANDLERS: dict[str, Callable[[], dict]] = {
    "GATE-01": lambda: run_unittest_case(Gate01TransactionTests),
}

def run_unittest_case(case_cls) -> dict:
    result = JsonCollectingResult()  # unittest.TestResult subclass
    unittest.TestLoader().loadTestsFromTestCase(case_cls).run(result)
    return {
        "status": "PASS" if result.wasSuccessful() else "FAIL",
        "violations": result.violations_as_json(),  # [{testId, description, outcome}]
        "message": "all tests passed" if result.wasSuccessful() else "violations present",
    }

def main(gate_id: str) -> None:
    handler = GATE_HANDLERS.get(gate_id)
    payload = handler() if handler else {
        "status": "ERROR", "violations": [], "message": "gate not wired",
    }
    print(json.dumps(payload))  # single line, stdout only

if __name__ == "__main__":
    main(sys.argv[1])
```

`GATE_HANDLERS` is the extension point for GATE-02/03/05 once each closes —
adding a gate is a new dict entry, not a redesign.

## Testing

- Each skill: `tests/skill.test.ts`. Stubs assert output shape + `status:"stub"`.
  `cic-run-gate` gets 3 cases: GATE-01 (live or adapter-mocked) → PASS/FAIL
  shape is well-formed; unknown gateId → ERROR; adapter crash/non-JSON stdout →
  ERROR.
- `skills/_cic-shared/tests/`: runId/bundleId format, artifact path builder,
  `writeResultJson` round-trip (write then read back matches input).
- No CI wiring in Phase 1. Skills are new and not yet Toolforge-registered
  (`integrations.cowork.registered: false`, `status: "pending_registration"`
  in each `skill.json`, matching `analyze-token-burn`'s current state).

## Explicitly out of scope (Phase 1)

- `/cic/` workspace directory tree (`agents/`, `gates/`, `configs/`,
  `artifacts/`, `lineage/`, `reports/`) beyond the per-tool `artifacts/<kind>/`
  paths each skill writes to directly.
- Any Grok Build integration/config (its MCP loading mechanism, CLI flags, or
  headless workflow spec format are unverified from this session).
- GATE-02, GATE-03, GATE-05 support in `cic-run-gate` (open gates, no ratified
  mechanics to wrap yet).
- Real `cic-ingest-world` backend (TorqueQuery is untracked/unstable).
- Real `cic-repair-pipeline` and `cic-consolidate-artifacts` logic.
- Deterministic commit-message templates, RUN-ID/GATE-ID/PROFILE-ID tagging
  conventions, and other governance-alignment items from the full 5-phase plan.
- Toolforge marketplace submission (`toolforge submit`) for these skills.

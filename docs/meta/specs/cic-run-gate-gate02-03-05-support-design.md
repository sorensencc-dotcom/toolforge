# cic-run-gate — GATE-02/03/05 Support Design

Date: 2026-07-17
Status: Draft, pending user approval

## Context

Phase 1 (`cic-tool-surface-phase1-design.md`) scoped `cic-run-gate` to
`GATE-01` only because it was "the sole gate with ratified, closed
mechanics." Phase 4 work (`cic-tool-surface-phase4-design.md`) discovered
`CIC-GOVERNANCE/MANIFEST/gate-implementation-status.md` was stale: GATE-02,
GATE-03, and GATE-05 were actually ratified `CLOSED` on 2026-07-14 (confirmed
via `gate-registry.json`, non-draft `AMD-v2.4.0-GATE-0{2,3,5}-CLOSED.json`
amendments, and matching ratification confirmations), and that status doc has
since been refreshed to reflect it. This spec is the actual extension —
adding GATE-02/03/05 to `GATE_HANDLERS`, exactly the point Phase 1's design
called out: *"adding a gate is a new dict entry, not a redesign."*

This is a standalone change, not tied to CIC Tool Surface Phase 5 (TorqueQuery
integration, still blocked/untracked).

## Verified starting state

- `CIC-GOVERNANCE/adapters/run_gate_adapter.py`: `GATE_HANDLERS` maps
  `"GATE-01" -> lambda: run_unittest_case(Gate01TransactionTests)`. Unknown
  gate IDs fall through to `{"status": "ERROR", "violations": [], "message":
  "gate not wired"}`. `run_unittest_case` is already generic over any
  `unittest.TestCase` subclass — no gate-specific logic in it.
- `CIC-GOVERNANCE/tests/test_gate_runtime.py` already has
  `Gate02PublicationTests`, `Gate03ActorTests`, `Gate05ActivationTests`
  classes (plus `Gate04LineageTests`, not in scope — see below) alongside
  `Gate01TransactionTests`, all importable the same way.
- `cic-run-gate/src/index.ts`: `GATE_ID_PATTERN = /^GATE-\d{2}$/` already
  accepts any two-digit gate ID — no TS-side change needed to allow
  GATE-02/03/05 through to the adapter. The skill's output contract
  (`RunGateOutput`) is gate-count-agnostic already.
- No TypeScript test currently exercises GATE-02/03/05 end-to-end (Phase 1's
  3 test cases were GATE-01, an unknown ID, and a malformed ID).

## Decisions

1. **Add exactly three `GATE_HANDLERS` entries: GATE-02, GATE-03, GATE-05.**
   One-line dict additions, matching the GATE-01 pattern precisely:
   ```python
   "GATE-02": lambda: run_unittest_case(Gate02PublicationTests),
   "GATE-03": lambda: run_unittest_case(Gate03ActorTests),
   "GATE-05": lambda: run_unittest_case(Gate05ActivationTests),
   ```
   No new adapter logic, no change to `run_unittest_case` or
   `JsonCollectingResult` — both already generic.
2. **GATE-04 excluded from this change.** It's already `CLOSED` and has a
   test class (`Gate04LineageTests`), but Phase 1's design explicitly says
   `cic-run-gate` only ever wrapped GATE-01 "the sole gate with ratified,
   closed mechanics" — GATE-04 wiring was never scoped in any prior doc and
   isn't asked for here. Adding it is a trivial follow-up once explicitly
   requested, not bundled speculatively.
3. **No TypeScript contract change.** `cic-run-gate/src/index.ts` already
   accepts any `/^GATE-\d{2}$/` id and passes it straight to the Python
   adapter via `spawn`. Zero code change on the TS side — this is entirely a
   Python-adapter + test change.
4. **No orchestrate-flow change.** `cic-orchestrate-flow` already defaults
   `gateId` to `"GATE-01"` but accepts any gate ID via its own input; once
   the adapter wires GATE-02/03/05, calling the flow with
   `gateId: "GATE-02"` etc. works with zero code change there either.

## Adapter change

```python
GATE_HANDLERS: dict[str, Callable[[], dict]] = {
    "GATE-01": lambda: run_unittest_case(Gate01TransactionTests),
    "GATE-02": lambda: run_unittest_case(Gate02PublicationTests),
    "GATE-03": lambda: run_unittest_case(Gate03ActorTests),
    "GATE-05": lambda: run_unittest_case(Gate05ActivationTests),
}
```
Import line gains the three new names from `test_gate_runtime`.

## Testing

- `CIC-GOVERNANCE/adapters/` currently has no adapter-level Python test file
  (behavior is exercised indirectly via `cic-run-gate`'s TS tests spawning
  the real adapter). Add three TS assertions to
  `cic-run-gate/tests/skill.test.ts`, mirroring the existing GATE-01 case:
  `GATE-02`, `GATE-03`, `GATE-05` each return a well-formed
  `PASS`/`FAIL`/`ERROR` result with `gateId` echoed back and `violations` an
  array — same shape assertion as the existing GATE-01 test, parameterized
  or duplicated per gate (match existing file's un-parameterized style).
- No change to `test_gate_runtime.py` itself — its gate test classes already
  exist and are unit-tested independently of the adapter.

## Explicitly out of scope

- GATE-04 wiring (see Decision 2).
- Any change to `cic-run-gate`'s TS contract, `_cic-shared`, or
  `cic-orchestrate-flow` — none needed.
- Re-running/re-verifying the underlying GATE-02/03/05 R2 closure evidence —
  that's already ratified governance history, not re-litigated here.
- CIC Tool Surface Phase 5 (TorqueQuery integration) — unrelated, still
  blocked.

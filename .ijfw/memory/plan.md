---
domain: software
time_budget: HOUR_4_5
brief_ref: docs/meta/specs/2026-09-07-toolforge-runtime-owner-design.md
spec_ref: docs/meta/specs/2026-09-07-toolforge-runtime-owner-design.md
created_at: 2026-09-08T03:00:00Z
---

# PLAN — Toolforge runtime owner Phase A

## Goal

Deliver a Linux-first internal `modules/runtime-owner/` library that supervises owned process groups with bounded polling enforcement and proves the lifecycle contract through focused tests and one labeled Open Notebook integration test.

## Success Criteria

1. `modules/runtime-owner/` exposes the approved internal API and rejects shell execution, invalid envelopes, unsupported platforms, foreign ownership, and non-allowlisted environment variables.
2. PGID is the lifecycle, limit, and termination unit; CPU and RSS aggregate all observed group members, and termination uses process-group signaling.
3. Timeout, concurrency, CPU, memory, and orphan scenarios produce deterministic state transitions and monotonic per-group event sequences.
4. JSONL persistence failure never prevents termination or cleanup and remains visible through the callback and stderr fallback.
5. Focused Linux tests pass under the repository’s hard timeout protocol.
6. The Open Notebook fixture test uses the locked argv, cwd, environment allowlist, isolated loopback port, health wait, and `RUNTIME_FIXTURE_UNAVAILABLE` skip code.

## Tasks

### Task task_id: T01 — Define runtime-owner contracts
- **Deliverable:** `modules/runtime-owner/types.mjs` and module entrypoint contract.
- **Acceptance:** Envelope, group, process, event, enforcement mode, and legal state-transition schemas reject invalid values and document PGID/null-PID semantics.
- **Touches:** `modules/runtime-owner/types.mjs`, `modules/runtime-owner/index.mjs`.
- **Depends:** none
- **Risk:** low — contract is isolated and fixture-backed.

### Task task_id: T02 — Implement process-group lifecycle
- **Deliverable:** `modules/runtime-owner/process-groups.mjs` and `supervisor.mjs`.
- **Acceptance:** Spawn uses argv arrays, `detached: true`, explicit stdio handling, records PID and PGID, and terminates the whole group with graceful then forceful signaling.
- **Touches:** `modules/runtime-owner/process-groups.mjs`, `modules/runtime-owner/supervisor.mjs`.
- **Depends:** T01
- **Risk:** high — signal and child-process behavior is platform-sensitive.

### Task task_id: T03 — Add envelope and group monitoring
- **Deliverable:** `modules/runtime-owner/limits.mjs` and monitoring integration.
- **Acceptance:** 250 ms polling computes aggregate group CPU and RSS, requires two consecutive violations, enforces concurrency and timeout, and records the sub-250 ms sampling limitation.
- **Touches:** `modules/runtime-owner/limits.mjs`, `modules/runtime-owner/supervisor.mjs`.
- **Depends:** T02
- **Risk:** high — `/proc` sampling can miss short-lived descendants.

### Task task_id: T04 — Add durable ownership and orphan cleanup
- **Deliverable:** `modules/runtime-owner/orphan-cleanup.mjs` and durable group-state format.
- **Acceptance:** A simulated supervisor crash permits cleanup only for matching stale PID/PGID records; foreign or ambiguous processes remain untouched and produce cleanup failures.
- **Touches:** `modules/runtime-owner/orphan-cleanup.mjs`, `modules/runtime-owner/supervisor.mjs`.
- **Depends:** T02
- **Risk:** high — incorrect correlation could terminate unrelated processes.

### Task task_id: T05 — Add deterministic event logging
- **Deliverable:** `modules/runtime-owner/logs.mjs`.
- **Acceptance:** JSONL events include group identity, nullable PID, PGID, owner, workflow ID, enforcement mode, and monotonic sequence; write failures surface through the callback and stderr without blocking termination.
- **Touches:** `modules/runtime-owner/logs.mjs`, `modules/runtime-owner/supervisor.mjs`.
- **Depends:** T01, T02
- **Risk:** medium — failure paths must preserve cleanup guarantees.

### Task task_id: T06 — Add focused lifecycle tests
- **Deliverable:** `modules/runtime-owner/*.test.mjs`.
- **Acceptance:** Linux tests cover normal exit, invalid input, allowlisting, state transitions, concurrency, timeout, CPU/RSS dwell, group termination, ownership mismatch, orphan cleanup, event ordering, and persistence failure.
- **Touches:** `modules/runtime-owner/*.test.mjs`.
- **Depends:** T03, T04, T05
- **Risk:** medium — resource tests need deterministic bounded fixtures.

### Task task_id: T07 — Defer Open Notebook consumer integration
- **Deliverable:** Phase B handoff note; no Phase A integration code.
- **Acceptance:** Handoff names the expected consumer checkout, Phase B contract preconditions, and required signed-off fixture/runtime inputs; no placeholder CI command is treated as executable.
- **Touches:** `integration-harness/T07-README.md`, `STATUS.md`.
- **Depends:** T06
- **Risk:** low — integration is explicitly deferred until its owner and reproducible fixture are available.

### Task task_id: T08 — Run bounded verification and update handoff
- **Deliverable:** test receipts, `git diff --check` result, and updated `STATUS.md`.
- **Acceptance:** Focused tests run with hard timeouts, skipped smoke tests are labeled rather than counted as proof, unrelated dirty files remain untouched, and status records completed work, evidence, blockers, and next action.
- **Touches:** `STATUS.md`, test output artifacts only when required by existing conventions.
- **Depends:** T06, T07
- **Risk:** medium — CI or host limitations may block live fixture proof.

## Dependency Wave Table

| Wave | Tasks (parallel within wave) | Gates between waves |
|------|------------------------------|---------------------|
| W1 | T01 | Contract schemas pass focused validation. |
| W2 | T02 | Group spawn and kill behavior passes. |
| W3 | T03, T04, T05 | Monitoring, orphan ownership, and event fallback contracts pass. |
| W4 | T06 | Focused lifecycle suite passes. |
| W5 | T07 | Open Notebook fixture contract is available or emits the named skip code. |
| W6 | T08 | All evidence is labeled and status is current. |

## Out of Scope (Deferred to backlog)

- Standalone `toolforge-runtime-owner` repository or published package.
- HTTP or IPC control API.
- TRM event ingestion, KB-Sync writes, CIC gates, or Sigil controls.
- Automatic restart policies, cloud fallback, production substrate selection, and canonical-store access.
- Windows resource enforcement, kernel-hard cgroups, container isolation, and production deployment claims.

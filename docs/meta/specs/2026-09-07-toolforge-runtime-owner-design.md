# Toolforge runtime owner design

**Status:** DESIGN — ready for written review  
**Owner:** Toolforge  
**Phase:** A — internal Linux lifecycle proof  
**Version:** 0.1

## Decision

Create `modules/runtime-owner/` in Toolforge. Phase A proves process-group lifecycle governance for one supervised Open Notebook fixture consumed by the `toolforge-herdr-trm-integration` test boundary. It does not create a standalone repository, public package, HTTP API, TRM event publisher, KB-Sync integration, CIC integration, or Sigil control surface.

Phase A targets Linux CI. Resource enforcement uses polling and is explicitly labeled `linux-polling`; it does not claim kernel-hard CPU or memory isolation. Container or cgroup enforcement remains a later implementation behind the same internal interface.

## Problem and boundaries

Toolforge owns process lifecycle and runtime ceilings. TRM owns research policy, lineage, receipts, and canonical-write decisions. The runtime owner emits local structured events only; later phases may define ingestion contracts.

The supervisor may spawn only explicitly supplied command argument arrays. It must reject shell-string execution, malformed commands, missing owner or workflow identity, invalid limits, unsupported platforms, and ownership mismatches. No child may write canonical TRM, KB-Sync, CIC, or Sigil stores as part of Phase A.

## Components

```text
caller
  -> supervisor API
      -> process-groups      detached group and signals
      -> limits              /proc polling and violations
      -> orphan-cleanup      ownership-token scan
      -> logs                deterministic JSONL events
```

- `modules/runtime-owner/types.mjs`: schemas for envelopes, groups, processes, states, and events.
- `modules/runtime-owner/supervisor.mjs`: group creation, spawning, monitoring, state transitions, and cleanup.
- `modules/runtime-owner/limits.mjs`: group-aggregate CPU/RSS sampling, concurrency checks, and violation decisions.
- `modules/runtime-owner/process-groups.mjs`: detached process groups and graceful/force termination with `killpg`.
- `modules/runtime-owner/orphan-cleanup.mjs`: stale-group detection using durable ownership tokens and safe termination.
- `modules/runtime-owner/logs.mjs`: append-only deterministic JSONL event sink.
- `modules/runtime-owner/index.mjs`: internal library API.

## Internal API

```js
createGroup(owner, envelope) -> groupId
spawnInGroup(groupId, commandArgs, envAllowlist) -> { pid, pgid }
getGroupStatus(groupId) -> { pids, pgid, cpuUsage, rssUsage, state }
terminateGroup(groupId, gracefulTimeoutSeconds) -> result
extendEnvelope(groupId, extension) -> result
onEvent(callback) -> unsubscribe
```

`commandArgs` is an argv array. The supervisor never invokes a shell. Each group receives a generated ID and ownership token stored in the durable group record. Only explicitly allowlisted environment variables are passed to children; the token is not passed through the environment.

Envelope fields:

`cpu_limit_percent`, `memory_limit_mb`, `max_concurrency`, `timeout_seconds`, `restart_policy`, and `workflow_id`. `owner` is supplied only to `createGroup` and stored in the group record.

Phase A samples every 250 ms. CPU is aggregate group CPU time normalized against one CPU core; RSS is the sum of `/proc/<pid>/status` `VmRSS` values for all group members. A limit violation requires two consecutive samples, providing a 500 ms dwell. `max_concurrency` counts live group members.

Phase A accepts only `restart_policy: "none"`. Other policies are rejected until restart semantics are designed and tested.

## Lifecycle and failure behavior

```text
createGroup -> spawnInGroup -> monitoring
                         |-> normal exit -> cleanup -> closed
                         |-> timeout ------> graceful -> force -> closed
                         |-> violation ----> graceful -> force -> closed
                         |-> operator stop -> graceful -> force -> closed
```

Legal states are `created -> running -> {terminating, violating} -> closed`. `created` may also become `closed` after spawn failure. `terminating` and `violating` cannot return to `running`. `extendEnvelope` is allowed only in `created` or `running`, cannot change owner, and cannot raise any ceiling after `violating` or `terminating`.

The supervisor fails closed on invalid input, spawn failure, monitor failure, unsupported platform, and incomplete cleanup. A violation emits one deterministic violation event and transitions the group to `violating`. Graceful termination is followed by force termination after the bounded grace period. Phase A performs no automatic restart. Termination always proceeds even when event persistence fails; persistence failure is emitted as `cleanup_failed` after the group reaches `closed`.

An orphan is removable only when its ownership token matches a stale supervisor-owned group record. Ambiguous or foreign processes are preserved and reported as cleanup failures.

## Events

Every event is JSONL and includes:

`event_id`, `seq`, `event_type`, `group_id`, `pgid`, `pid` (nullable for group-level events), `owner`, `workflow_id`, `timestamp`, `state`, `reason`, and `enforcement_mode: "linux-polling"`. `seq` is a monotonically increasing per-group integer and defines ordering independently of timestamp resolution.

Required event types are `group_created`, `process_spawned`, `process_exited`, `timeout`, `resource_violation`, `termination_started`, `process_killed`, `orphan_detected`, `cleanup_completed`, and `cleanup_failed`.

Event ordering is deterministic within one group. Event persistence failure is surfaced to the caller, but never prevents termination or cleanup; the final `cleanup_failed` event records the persistence failure after the group reaches `closed`.

## Testing and evidence

Focused `node:test` coverage proves invalid-envelope rejection, environment allowlisting, normal exit, concurrency limits, timeout, graceful/force termination, group-aggregate CPU and RSS threshold detection with the two-sample dwell, orphan cleanup, ownership mismatch, legal state transitions, deterministic sequence ordering, and cleanup after monitor failure.

One separate Linux CI smoke test runs the pinned Open Notebook fixture through `toolforge-herdr-trm-integration`. The fixture contract is: `commandArgs: ["uv", "run", "--directory", "open-notebook", "python", "-m", "open_notebook"]`; `cwd` is the checked-out Open Notebook fixture directory; environment is limited to `PATH`, `HOME`, `OPEN_NOTEBOOK_PORT`, and explicitly declared provider variables; `OPEN_NOTEBOOK_PORT` is an isolated CI-assigned loopback port; health-wait polls `GET /health` every 250 ms for at most 30 seconds; the bounded request targets `POST /chat/execute`; and missing fixture/runtime is reported as `RUNTIME_FIXTURE_UNAVAILABLE`. The test verifies health, one bounded request, clean termination, and absence of owned processes. A skip is not production or lifecycle proof.

Evidence must distinguish polling-based local lifecycle tests, the labeled Open Notebook smoke test, and any future production evidence.

## Acceptance criteria

- Internal module enforces the declared Phase A lifecycle contract in Linux CI.
- Timeout performs graceful then forceful termination.
- CPU, memory, and concurrency violations produce bounded termination behavior.
- Orphan cleanup removes only supervisor-owned stale groups.
- Every lifecycle event contains `workflow_id`, `owner`, and enforcement mode.
- Open Notebook smoke test is deterministic when its fixture is installed.
- No Phase A HTTP API, cross-repository event publishing, production substrate selection, or canonical-store write exists.

## Deferred work

Phase B may stabilize an internal HTTP or IPC API, metrics, TRM event ingestion, consumer contract tests, and stronger enforcement. Phase C may extract a standalone repository after multiple integrations, failure-mode drills, security review, compatibility policy, and a signed authority decision.

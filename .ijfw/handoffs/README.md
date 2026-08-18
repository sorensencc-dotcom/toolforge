# Handoff Artifacts — Convention (§13.1–13.2, gate 1 approved 2026-08-17)

Spec: [multi-agent-handoff-protocol.md](../../docs/meta/governance/multi-agent-handoff-protocol.md)
Status: gate 1 (design) approved. Gate 2 (enforcement) NOT live — this dir is advisory record-keeping only, nothing blocks on it yet.

## Files per run

- `<run_id>-<seq>.jsonl` — append-only handoff-event log. One JSON object per line, never rewritten. Last line = current state.
- `<run_id>-checkpoints.log` — append-only checkpoint log (§13.2). One line per checkpoint.

`run_id` format: `<charter-id>-<yyyyMMddTHHmmss>`, minted once at run start by `scripts/handoff-bootstrap.ps1`.

## Minting a run

```powershell
scripts/handoff-bootstrap.ps1 -CharterId <charter-id> -PredecessorAgent claude -TotalTasks <n> -EntryPoint "<what this run is doing>"
```

Writes seq-0 line to `.ijfw/handoffs/<run_id>-0.jsonl` and prints `run_id` / `run_started_utc` — pass both to every later append.

## Appending a handoff event

```powershell
scripts/handoff-append.ps1 -RunId <run_id> -Seq <n> -PredecessorAgent <a> -SuccessorAgent <b|null> -CurrentTask <n> -TotalTasks <n> -Status in_progress -EntryPoint "<resume note>"
```

## Appending a checkpoint

```powershell
scripts/handoff-checkpoint.ps1 -RunId <run_id> -CurrentTask <n> -TotalTasks <n> -Blockers "<text|none>"
```

Fires per §13.2 cadence: every 60 min wall-clock, or every 15 tasks on runs with `total_tasks >= 15`. Not auto-triggered yet (no SDD-runner wiring — Integration Points, gate 2) — call manually at those thresholds.

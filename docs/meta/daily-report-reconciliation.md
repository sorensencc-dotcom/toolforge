# Daily Report Reconciliation Engine

## Overview

The Daily Report Reconciliation Engine (`scripts/reconcile-daily-reports.mjs`) provides closed-loop state verification, daemon telemetry assertions, day-over-day report diffing, and automated gap resolutions across Toolforge and Ironbots subsystems.

## Operating Architecture

```
+-----------------------------------------------------------------------------+
|                     Daily Report Reconciliation Engine                      |
|                     scripts/reconcile-daily-reports.mjs                     |
+-----------------------------------------------------------------------------+
         |                        |                       |
         v                        v                       v
[1. Ground-Truth Sync]  [2. Telemetry Heartbeat]  [3. Day-over-Day Diff]
 - git log / gh issue    - mtime & timestamp       - Landed commit deltas
 - Quarantine cleanse    - >24h dormancy gate      - Stagnant loop alerts
 - Zombie card purge     - [SEV-1 PIPELINE_STALL]  - Claim entropy scan
         \                        |                       /
          +-----------------------+----------------------+
                                  |
                                  v
                    [4. Automated Gap Resolution]
                     - FCSC Cuban Claim Rolls
                     - Danish Royal Honors
                     - Reconcile notebook findings
                     - Update trm-research-gaps.md
                     - Emit receipts to mobile-outbox
```

## The Four Reconciliation Phases

### 1. Ground-Truth State Verification (`verifyGroundTruthState`)
- Inspects pending action cards in `.harness/tasks/pending/`, quarantine queues in `trm-drive/inbox/quarantine/`, and open items in `daily_status.json`.
- Queries `gh issue view` and `git log` to establish actual status.
- When an item is marked closed or landed in Git (such as Issue #140 / `act-kbsync-chat-injection-staleness-entropy-fail`), cleanses zombie artifacts, moves tasks to completed archives, and clears them from active status feeds.

### 2. Pipeline Heartbeat & Telemetry Assertion (`assertPipelineHeartbeats`)
- Audits filesystem modification timestamps and internal timestamps across `_status-feed/`:
  - `notebook_ingester_report.json`
  - `kb_sentinel_report.json`
  - `trm_bot_report.json`
  - `watchlist_miner_report.json`
  - `daemon_health.json`
  - `scheduled_tasks_roster.json`
  - `trm_ingress_status.json`
- If an active daemon exceeds its dormancy threshold (default 24h), triggers an immediate `[SEV-1 PIPELINE_STALL]` alert banner in `daily_status.json` rather than burying the failure in section-5 logs.

### 3. Day-over-Day Differential & Stagnation Detection (`detectDayOverDayDifferential`)
- Diffs today's daily briefing against yesterday's briefing in `docs/reports/daily/`.
- Computes landed commits, closed gaps, and newly opened blockers.
- Measures claim and prompt entropy: if a specific query or claim repeats verbatim across 2 or more consecutive reports without supporting commits, flags a `[STAGNANT_LOOP]` warning.

### 4. Automated Gap Resolution (`resolveDocumentedGaps`)
- Scans briefings and wiki research for documentary evidence:
  - FCSC Cuban claim rolls (Title V statutory standards, certified claim numbers).
  - Soren P. Sorensen Royal Danish Honors (Order of the Dannebrog 1930/1937, King Christian X royal decree).
- Updates `daily_status.json` via canonical findings reconciliation.
- Toggles gap checkboxes from `- [ ]` to `- [x]` in `trm-research-gaps.md` and `kb-sync/trm-research-gaps.md`.
- Emits structured completion receipts (`receipt-<id>-completed.json` and `.md`) to active outbox folders (`trm-drive/inbox/outbox` and `G:/My Drive/TRM-Research/mobile-outbox`).

## Scheduled Cadence (3x Daily)

The task is registered in Windows Task Scheduler as `\Ironbots\Daily-Report-Reconciliation` via `scripts/schedule-task-wrapper-Reconcile-Daily-Reports.ps1`:

1. **06:30 AM EST**: Preflights and cleanses the knowledge plane before the 07:00 AM Morning Ingestion pass.
2. **11:15 AM EST**: Runs 30 minutes before the 11:45 AM Daily Intelligence Briefing to verify daemon heartbeats, ensure the SEV-1 banner trips if a runner stalled, and purge completed cards.
3. **06:00 PM EST**: Catches afternoon git commits and closes out the working day.

### Unattended Elevation (S4U)
To register the task to run without an active interactive logon, run PowerShell as Administrator:
```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\dev\scripts\schedule-task-wrapper-Reconcile-Daily-Reports.ps1 -Action Register
```

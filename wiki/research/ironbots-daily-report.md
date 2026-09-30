---
title: "Ironbots Daily Fleet Activity Report"
category: "reporting"
status: "active"
created_at: "2026-09-30"
tags:
  - ironbots
  - daily-report
  - telemetry
  - fleet-health
---

# Ironbots daily fleet activity report

**Date**: 2026-09-30 | **Fleet Health Score**: **89/100** (`HEALTHY`)

---

## 1. Fleet executive summary
- **Active Bots Supervised**: 9 / 9
- **Host Heartbeat**: `WIN-DTA4V21LKVR` (Uptime: `103h 22m`)
- **Task Scheduler Registry**: `HEALTHY` (10 tasks verified under \`Ironbots\`)
- **Knowledge Documents Indexed (FTS5)**: 433
- **Wiki Health Score**: 98/100
- **Total Research Gaps Tracked**: 0
- **Competitor Drifts Flagged**: 0
- **Daemon Port 8080 Health**: `HEALTHY`
- **CI Workflow Failures**: 1

---

## 2. Active bot activity roster

| Bot Name | Schedule | Status | Summary |
|---|---|---|---|
| **NotebookLM & Knowledge Ingester** | `Daily 02:00 AM` | `HEALTHY` | 433 documents indexed into SQLite FTS5 |
| **KB-Sentinel Drift & Autoheal** | `Daily 03:00 AM` | `PASS` | Health Score: 98/100 (420 files scanned) |
| **TRM Gap Triage & RFC Drafter** | `Daily 04:00 AM` | `PASS` | 0 total gaps (0 drafted) |
| **Watchlist & Competitor Drift Miner** | `Daily 05:00 AM` | `PASS` | 3 targets evaluated (0 drifts) |
| **Daemon-Healer Port 8080 Supervisor** | `Every 15 Min` | `HEALTHY` | Port 8080 status: HEALTHY (healed: false) |
| **IronLedger-Sentinel Workbench & Sync Supervisor** | `Every 15 Min` | `HEALTHY` | Status: HEALTHY (UI/API: OK, Container: Up 2 days (healthy), Syncs: HEALTHY) |
| **CI-Watchdog Workflow Failure Triage** | `Daily 06:00 AM` | `FAILURES_DETECTED` | 10 runs scanned (1 failures) |
| **TRM-Drive-Sync Ingress Watcher** | `Continuous / On-Demand` | `HEALTHY` | 9 action cards tracked (2 completed, 1 staged) |
| **Storage-Pruner SQLite & Telemetry Compactor** | `Weekly Sun 03:30 AM` | `HEALTHY` | Reclaimed 5.86 MB (6 DBs vacuumed) |

---

## 3. Related telemetry & logs
- [[Ironbots]]
- [[Index]]
- Primary JSON Feed: `_status-feed/ironbots_daily_report.json`

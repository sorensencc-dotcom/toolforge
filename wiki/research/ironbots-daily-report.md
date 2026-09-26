---
title: "Ironbots Daily Fleet Activity Report"
category: "reporting"
status: "active"
created_at: "2026-09-26"
tags:
  - ironbots
  - daily-report
  - telemetry
  - fleet-health
---

# Ironbots daily fleet activity report

**Date**: 2026-09-26 | **Fleet Health Score**: **46/100** (`ATTENTION_REQUIRED`)

---

## 1. Fleet executive summary
- **Active Bots Supervised**: 7 / 7
- **Host Heartbeat**: `WIN-DTA4V21LKVR` (Uptime: `21h 37m`)
- **Task Scheduler Registry**: `HEALTHY` (8 tasks verified under \`Ironbots\`)
- **Knowledge Documents Indexed (FTS5)**: 436
- **Wiki Health Score**: 21/100
- **Total Research Gaps Tracked**: 4454
- **Competitor Drifts Flagged**: 2
- **Daemon Port 8080 Health**: `HEALTHY`
- **CI Workflow Failures**: 3

---

## 2. Active bot activity roster

| Bot Name | Schedule | Status | Summary |
|---|---|---|---|
| **NotebookLM & Knowledge Ingester** | `Daily 02:00 AM` | `HEALTHY` | 436 documents indexed into SQLite FTS5 |
| **KB-Sentinel Drift & Autoheal** | `Daily 03:00 AM` | `FAIL` | Health Score: 21/100 (3024 files scanned) |
| **TRM Gap Triage & RFC Drafter** | `Daily 04:00 AM` | `PASS` | 4454 total gaps (4454 drafted) |
| **Watchlist & Competitor Drift Miner** | `Daily 05:00 AM` | `DRIFT_DETECTED` | 2 targets evaluated (2 drifts) |
| **Daemon-Healer Port 8080 Supervisor** | `Every 15 Min` | `HEALTHY` | Port 8080 status: HEALTHY (healed: false) |
| **CI-Watchdog Workflow Failure Triage** | `Daily 06:00 AM` | `FAILURES_DETECTED` | 10 runs scanned (3 failures) |
| **TRM-Drive-Sync Ingress Watcher** | `Continuous / On-Demand` | `HEALTHY` | 3 action cards tracked (1 completed, 1 staged) |

---

## 3. Related telemetry & logs
- [[Ironbots]]
- [[Index]]
- Primary JSON Feed: `_status-feed/ironbots_daily_report.json`

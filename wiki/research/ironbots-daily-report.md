---
title: "Ironbots Daily Fleet Activity Report"
category: "reporting"
status: "active"
created_at: "2026-09-28"
tags:
  - ironbots
  - daily-report
  - telemetry
  - fleet-health
---

# Ironbots daily fleet activity report

**Date**: 2026-09-28 | **Fleet Health Score**: **73/100** (`DEGRADED`)

---

## 1. Fleet executive summary
- **Active Bots Supervised**: 7 / 7
- **Host Heartbeat**: `WIN-DTA4V21LKVR` (Uptime: `56h 19m`)
- **Task Scheduler Registry**: `HEALTHY` (9 tasks verified under \`Ironbots\`)
- **Knowledge Documents Indexed (FTS5)**: 414
- **Wiki Health Score**: 92/100
- **Total Research Gaps Tracked**: 0
- **Competitor Drifts Flagged**: 2
- **Daemon Port 8080 Health**: `HEALTHY`
- **CI Workflow Failures**: 2

---

## 2. Active bot activity roster

| Bot Name | Schedule | Status | Summary |
|---|---|---|---|
| **NotebookLM & Knowledge Ingester** | `Daily 02:00 AM` | `HEALTHY` | 414 documents indexed into SQLite FTS5 |
| **KB-Sentinel Drift & Autoheal** | `Daily 03:00 AM` | `PASS` | Health Score: 92/100 (414 files scanned) |
| **TRM Gap Triage & RFC Drafter** | `Daily 04:00 AM` | `PASS` | 0 total gaps (0 drafted) |
| **Watchlist & Competitor Drift Miner** | `Daily 05:00 AM` | `DRIFT_DETECTED` | 2 targets evaluated (2 drifts) |
| **Daemon-Healer Port 8080 Supervisor** | `Every 15 Min` | `HEALTHY` | Port 8080 status: HEALTHY (healed: false) |
| **CI-Watchdog Workflow Failure Triage** | `Daily 06:00 AM` | `FAILURES_DETECTED` | 10 runs scanned (2 failures) |
| **TRM-Drive-Sync Ingress Watcher** | `Continuous / On-Demand` | `HEALTHY` | 4 action cards tracked (1 completed, 2 staged) |

---

## 3. Related telemetry & logs
- [[Ironbots]]
- [[Index]]
- Primary JSON Feed: `_status-feed/ironbots_daily_report.json`

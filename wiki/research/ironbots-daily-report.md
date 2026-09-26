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

**Date**: 2026-09-26 | **Fleet Health Score**: **80/100** (`DEGRADED`)

---

## 1. Fleet executive summary
- **Active Bots Supervised**: 7 / 7
- **Knowledge Documents Indexed (FTS5)**: 436
- **Wiki Health Score**: 99/100
- **Total Research Gaps Tracked**: 4454
- **Competitor Drifts Flagged**: 0
- **Daemon Port 8080 Health**: `HEALTHY`
- **CI Workflow Failures**: 2

---

## 2. Active bot activity roster

| Bot Name | Schedule | Status | Summary |
|---|---|---|---|
| **NotebookLM & Knowledge Ingester** | `Daily 02:00 AM` | `HEALTHY` | 436 documents indexed into SQLite FTS5 |
| **KB-Sentinel Drift & Autoheal** | `Daily 03:00 AM` | `PASS` | Health Score: 99/100 (3024 files scanned) |
| **TRM Gap Triage & RFC Drafter** | `Daily 04:00 AM` | `PASS` | 4454 total gaps (4454 drafted) |
| **Watchlist & Competitor Drift Miner** | `Daily 05:00 AM` | `PASS` | 2 targets evaluated (0 drifts) |
| **Daemon-Healer Port 8080 Supervisor** | `Every 15 Min` | `HEALTHY` | Port 8080 status: HEALTHY (healed: false) |
| **CI-Watchdog Workflow Failure Triage** | `Daily 06:00 AM` | `FAILURES_DETECTED` | 10 runs scanned (2 failures) |
| **TRM Mobile Ingress & Auto-Triage Watcher** | `Continuous / On-Demand` | `HEALTHY` | 5 action cards tracked (1 completed, 1 staged) |

---

## 3. Related telemetry & logs
- [[Ironbots]]
- [[Index]]
- Primary JSON Feed: `_status-feed/ironbots_daily_report.json`

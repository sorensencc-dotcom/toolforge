---
title: "Ironbots Daily Fleet Activity Report"
category: "reporting"
status: "active"
created_at: "2026-09-21"
tags:
  - ironbots
  - daily-report
  - telemetry
  - fleet-health
---

# Ironbots daily fleet activity report

**Date**: 2026-09-21 | **Fleet Health Score**: **93/100** (`HEALTHY`)

---

## 1. Fleet executive summary
- **Active Bots Supervised**: 6 / 6
- **Knowledge Documents Indexed (FTS5)**: 463
- **Wiki Health Score**: 92/100
- **Total Research Gaps Tracked**: 2056
- **Competitor Drifts Flagged**: 3
- **Daemon Port 8080 Health**: `RECOVERED`
- **CI Workflow Failures**: 0

---

## 2. Active bot activity roster

| Bot Name | Schedule | Status | Summary |
|---|---|---|---|
| **NotebookLM & Knowledge Ingester** | `Daily 02:00 AM` | `HEALTHY` | 463 documents indexed into SQLite FTS5 |
| **KB-Sentinel Drift & Autoheal** | `Daily 03:00 AM` | `PASS` | Health Score: 92/100 (413 files scanned) |
| **TRM Gap Triage & RFC Drafter** | `Daily 04:00 AM` | `PASS` | 2056 total gaps (2056 drafted) |
| **Watchlist & Competitor Drift Miner** | `Daily 05:00 AM` | `DRIFT_DETECTED` | 3 targets evaluated (3 drifts) |
| **Daemon-Healer Port 8080 Supervisor** | `Every 15 Min` | `RECOVERED` | Port 8080 status: RECOVERED (healed: true) |
| **CI-Watchdog Workflow Failure Triage** | `Daily 06:00 AM` | `HEALTHY` | 6 runs scanned (0 failures) |

---

## 3. Related telemetry & logs
- [[Ironbots]]
- [[Index]]
- Primary JSON Feed: `_status-feed/ironbots_daily_report.json`

---
title: "RFC: IronBots Fleet Room Event Reporter & Stream Observability"
category: "research"
topic: "rfc-ironbots-room-event-reporter"
gap_id: "act-ironbots-room-event-reporter"
status: "draft"
created_at: "2026-10-03T16:38:00.000Z"
assigned_tier: "Tier 2 (Execution)"
routed_model: "claude-3-5-sonnet-20241022"
router_confidence: 0.85
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: null
citations:
  - "scripts/ironbots-daily-reporter.mjs"
  - "tests/ironbots.test.mjs"
  - "_status-feed/ironbots_room_event.json"
---

# RFC: IronBots Fleet Room Event Reporter & Stream Observability

## 1. Problem statement & observability latency

The IronBots fleet runs autonomous unattended maintenance daemons (Notebook Ingester, KB Sentinel, TRM Bot, Watchlist Miner, Daemon Healer, IronLedger Sentinel, CI Watchdog, TRM Ingress, Storage Pruner). Previously, fleet health was aggregated into batch daily reports and wiki logs:
1. **Batch aggregation latency**: Fleet health degradation or CI failure alerts were only reflected at scheduled report runs or manual file inspection.
2. **Lack of event-driven agent broadcast**: Inter-agent networks (Sigil rooms, Grokbot bridges, Slack channels) lacked structured event streams to trigger immediate autonomous remediation.

---

## 2. Real-time room event protocol & payload schema

The `ironbots-daily-reporter.mjs` module now implements `generateRoomEventPayload(dailyReport)` emitting real-time event payloads:

### 2.1 Event schema
```json
{
  "event_type": "ironbots.fleet_event",
  "timestamp": "2026-10-03T16:38:00.000Z",
  "room_id": "sigil-fleet-observability",
  "fleet_health_score": 95,
  "fleet_status": "HEALTHY",
  "bot_count": 9,
  "alerts": [],
  "formatted_message": "🤖 [IronBots Fleet Report] Score: 95/100 (HEALTHY) | Bots: 9 | All Subsystems Operational",
  "summary_metrics": { ... }
}
```

### 2.2 Alert condition filters
- **CI Failures**: Triggered when GitHub Actions active run failures exceed 0.
- **Daemon 8080**: Triggered when dashboard server health status transitions away from `HEALTHY` / `RECOVERED`.
- **IronLedger Sentinel**: Triggered when Workbench API/UI or DB invariants degrade.
- **Competitor Drift**: Triggered when competitor scrapers detect external interface shifts.

---

## 3. Verification & test matrix

Unit tests in `tests/ironbots.test.mjs` verify:
- Accurate fleet health score and status propagation.
- Filtered alert generation for degraded subsystems.
- Real-time artifact emission to `_status-feed/ironbots_room_event.json`.

---

## 4. References & linked topics
- [[Ironbots]]
- [[Index]]
- [[trm-research-gaps]]
- [[Log]]

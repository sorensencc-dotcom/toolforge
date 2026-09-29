# ironbots-fleet-status-monitor Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    IRONBOTS FLEET TELEMETRY INGEST                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Scheduled Task Wrappers & Background Daemons                       │
│  ─────────────────────────────────────────────                      │
│  • Notebook-Ingester                                                │
│  • KB-Sentinel                                                      │
│  • TRM-Bot                                                          │
│  • Watchlist-Miner                                                  │
│  • Daemon-Healer                                                    │
│  • CI-Watchdog                                                      │
│  • TRM-Drive-Sync                                                   │
│  • Storage-Pruner                                                   │
│  • Ironbots-Reporter                                                │
│         │                                                           │
│         └─→ Emit JSON reports to _status-feed/*.json                │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Toolforge Skill: ironbots-fleet-status-monitor                     │
│  ──────────────────────────────────────────────                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ handler(action: "status" | "aggregate" | "diagnose")         │  │
│  │                                                              │  │
│  │ ┌─ ACTION: STATUS ───────────────────────────────────────┐  │  │
│  │ │ • Fast read of cached status files                     │  │  │
│  │ │ • Return: {status, fleetScore, tasks}                  │  │  │
│  │ └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │ ┌─ ACTION: AGGREGATE ────────────────────────────────────┐  │  │
│  │ │ • Evaluate all 9 task outputs                          │  │  │
│  │ │ • Compute fleet health score (0-100)                   │  │  │
│  │ │ • Surface failure alerts                               │  │  │
│  │ └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
    ┌──────────────┐                        ┌──────────────┐
    │ Daily Status │                        │ Dashboard    │
    │ Report Log   │                        │ Telemetry    │
    └──────────────┘                        └──────────────┘
```

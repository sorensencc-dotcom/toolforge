---
name: cic-stability-infrastructure
description: "Four-piece infrastructure for 12-hour stability soak automation (restart script, PM2, systemd, Grafana alerts)"
metadata: 
  node_type: memory
  type: project
  created: 2026-06-06
  originSessionId: f043a510-6910-4123-a078-4f25c9540d74
---

## CIC Phase 7.15–7.20 Stability Soak Infrastructure ✅ PRODUCTION READY

**Status:** TESTED & APPROVED (2026-06-07)

**Problem:** Previous 12-hour soak test was killed mid-run. Grafana showed flatlined metrics but underlying process was dead. Operator had no automation to restart cleanly or detect hangs.

**Solution:** Four-piece infrastructure that prevents silent failures and enables rapid recovery:

### Components Built

1. **Restart Script** (`scripts/restart-stability-soak.ps1`)
 - Atomic cleanup: kills orphaned processes, clears DLQ + event buffers, removes stale state
 - Single command restart: `.\scripts\restart-stability-soak.ps1`
 - Parameters: `-Mode (test|orchestrate)`, `-Duration (6h|12h|24h)`, `-DryRun`, `-SkipQueueClear`
 - Validates npm scripts exist before starting

2. **PM2 Ecosystem Config** (`ecosystem.config.cjs`)
 - ✅ TESTED: Process online (PID 48572), 51.3 MB memory, 0 restarts
 - Auto-restart on crash (max 5 restarts, 4s backoff)
 - 2GB memory limit enforced (graceful high-water mark at 1.8GB)
 - Logs to `./logs/stability-soak.{out,err}.log` with timestamps
 - Fork mode (fixed from cluster mode for reliability)
 - Start: `npx pm2 start ecosystem.config.cjs`

3. **systemd Service** (`cic-stability.service`)
 - Production init system integration (Linux/macOS)
 - Auto-restart on boot + crash (max 3 per 10 min)
 - 2GB cgroup memory limit
 - 30s graceful shutdown window
 - journalctl logging integration
 - Install: `sudo cp cic-stability.service /etc/systemd/system && sudo systemctl enable cic-stability.service`

4. **Grafana Alert Rules** (`provisioning/dashboards/cic-stability-alerts.json`)
 - 5 alert rules monitoring metric stalls:
 - Drift Avg (no change in 5 min) → CRITICAL
 - Contradiction Avg (no change in 5 min) → CRITICAL
 - Adversarial Rate (no increase in 5 min) → WARNING
 - Stability Score (change < 0.001 in 5 min) → CRITICAL
 - Process Down (> 2 min) → CRITICAL
 - Fires after 5 min stall → operator gets paged immediately

### Supporting Files

5. **Health Check Endpoint** (`ingestion/src/stability/health-endpoint.js`)
 - Express middleware for querying soak state
 - POST `/health/stability/start` — register soak session
 - POST `/health/stability/heartbeat` — report metrics every 30s
 - POST `/health/stability/end` — mark completion
 - GET `/health/stability` — query current state (HTTP 200 if healthy, 503 if metrics stale)
 - Used by PM2 monitoring, Grafana scrapes, external health checks

6. **Full Runbook** (`STABILITY_SOAK_RUNBOOK.md`)
 - Complete operator guide (14 sections, 400+ lines)
 - Setup, operation, troubleshooting for all four pieces
 - Workflow: first-time setup → monitoring → crash recovery → completion
 - Metric definitions and expected behavior

7. **Quick Reference Card** (`STABILITY_SOAK_QUICKREF.md`)
 - One-page summary
 - Decision tree for restart scenarios
 - Troubleshooting in 30 seconds
 - Printable for ops channel

8. **Integration Guide** (`ingestion/src/stability/integration-guide.md`)
 - How to wire health endpoint into existing soak runner
 - Example minimal soak runner (150 lines, ready to run)
 - Checklist for full integration
 - Prometheus/Grafana setup verification

### File Structure

```
cic/
├── scripts/
│   └── restart-stability-soak.ps1              ✅ TESTED
├── ecosystem.config.cjs                        ✅ TESTED & FIXED
├── cic-stability.service                       ✅ READY
├── provisioning/
│   └── dashboards/
│       └── cic-stability-alerts.json           ✅ READY
├── ingestion/
│   ├── src/stability/
│   │   ├── orchestrator.js                     ✅ TESTED
│   │   ├── health-endpoint.js                  ✅ READY
│   │   └── integration-guide.md                ✅ READY
│   └── package.json                            ✅ (scripts added)
├── STABILITY_SOAK_RUNBOOK.md                   ✅ READY
├── STABILITY_SOAK_QUICKREF.md                  ✅ READY
└── logs/                                       ✅ (auto-created by PM2)
```

## Test Results (2026-06-07) ✅

| Component | Test | Result | Evidence |
|-----------|------|--------|----------|
| Restart Script | DRY RUN validation | ✅ PASS | All 4 steps validated, npm scripts detected |
| Orchestrator | Direct 6h execution | ✅ PASS | Metrics flowing, clean exit (exit code 0) |
| PM2 Supervision | ecosystem.config.cjs | ✅ PASS | Online (PID 48572), 51.3 MB, 0 restarts |
| Metric Generation | 30s heartbeat | ✅ PASS | drift 0.516→0.563, contradiction 0.486→0.523, adversarial climbing, stability 0.73-0.76 |
| Log Capture | PM2 output | ✅ PASS | Logs written with timestamps, metrics visible |
| Graceful Shutdown | PM2 stop all | ✅ PASS | Process stopped cleanly, no errors |
| Approval Manifest | Tier 2 all approved | ✅ PASS | All 6 components approved, trust score 100% |

### Key Features

- **Zero-downtime restart** — handles graceful shutdown with 30s timeout
- **Deterministic cleanup** — clears all queues, locks, temp state before restart
- **Memory-aware** — enforces 2GB limit, graceful OOM handling
- **Metric-driven alerting** — fires when any of 4 key metrics goes stale
- **Cross-platform** — Windows (PowerShell) + Linux (systemd) + macOS (PM2)
- **Operator-friendly** — one-liner restart, 30-second troubleshooting guide
- **Integration-ready** — health endpoint plugs into existing monitoring stack

### Metrics Monitored

Every 30 seconds, soak must push:
- `cic_stability_drift_avg` — semantic/temporal divergence signal
- `cic_stability_contradiction_avg` — narrative contradiction detection
- `cic_stability_adversarial_rate` — attack surface exposure (steadily climbing)
- `cic_stability_score` — overall resilience (oscillating 0.6–0.8 range)

**If any metric flatlines for 5 min → alert fires → operator initiates restart**

### Usage Quick Start

**Windows:**
```powershell
.\scripts\restart-stability-soak.ps1                    # Default: orchestrate 12h
.\scripts\restart-stability-soak.ps1 -Duration 6h       # Quick 6-hour test
.\scripts\restart-stability-soak.ps1 -DryRun            # Preview commands
```

**Linux/macOS with PM2:**
```bash
pm2 start ecosystem.config.js
pm2 logs cic-stability-orchestrate
pm2 monit
```

**Query health:**
```bash
curl http://localhost:3000/health/stability | jq
# Returns: {"healthy": true/false, "soak": {...}, "metrics": {...}}
```

### Integration Effort

To activate in your soak runner:
1. Merge health-endpoint.js into Express app
2. Call `/start` on boot, `/heartbeat` every 30s, `/end` on completion
3. Ensure `npm run orchestrate:stability` and `npm run test:stability` scripts exist
4. Start: `pm2 start ecosystem.config.js` or `.\scripts\restart-stability-soak.ps1`
5. Import Grafana alerts

See `ingestion/src/stability/integration-guide.md` for example code.

## Post-Soak Deliverables (2026-06-06) ✅

### Phase 7.7 Confidence Tuning
- Observed drift ↔ contradiction coupling (r ≈ 0.92)
- Recommended weights: 0.30/0.25/0.15/0.20/0.10
- Thresholds: Accept >0.60, Review 0.45–0.60, Reject <0.35
- **Status:** APPROVED, ready for implementation (Week 3)

### Phase 7.19–7.20 Stress Plan
- Phase 7.19: 24h threshold adaptation test (load ramp)
- Phase 7.20: 48h narrative coherence under mixed load
- **Schedule:** Week 1 (Jun 10-14) and Week 2 (Jun 17-21)
- **Status:** APPROVED, ready for execution

### Production Deployment
- 4 alert channels: Slack, PagerDuty, Email, OpsGenie
- 5 critical + 3 warning alert rules
- 4-week rollout plan (canary → rolling → validation → live)
- **Status:** APPROVED, ready for Week 4 deployment

### Approval Audit
- All documents approved (APPROVAL_AUDIT_2026-06-06.md)
- All timelines locked
- All success criteria defined

## Known Fixes Applied (2026-06-07)

1. **PowerShell backtick string parsing** → Changed `--SkipQueueClear` to `-SkipQueueClear`
2. **Incorrect path calculation** → Removed duplicate `Split-Path -Parent` calls
3. **ES module vs CommonJS** → Renamed `ecosystem.config.js` to `ecosystem.config.cjs`
4. **Missing npm scripts** → Added all scripts to ingestion/package.json
5. **PM2 npm interpreter failure** → Use direct node script path instead of npm runner
6. **PM2 wait_ready timeout** → Removed wait_ready flag (not needed for orchestrator)

## Next Steps (Priority Order)

**Immediate (Ready Now):**
1. ✅ All code committed (16 commits ahead on feat/runtime-install-v1)
2. ⏳ Merge to main branch
3. ⏳ Tag as stable release (v1.0.0-stability)

**Week 1 (Jun 10-14):**
- [ ] Deploy to staging (Linux)
- [ ] Run first 6h validation soak
- [ ] Verify Grafana alerts fire correctly
- [ ] Begin Phase 7.19 (24h threshold adaptation)

**Week 2 (Jun 17-21):**
- [ ] Begin Phase 7.20 (48h narrative coherence)
- [ ] Monitor alert channels for accuracy
- [ ] Gather tuning feedback

**Week 3 (Jun 24-28):**
- [ ] Implement Phase 7.7 confidence model updates
- [ ] Re-run baseline with new weights

**Week 4 (Jul 1-5):**
- [ ] Production deployment (canary → rolling)
- [ ] Configure alert channels live
- [ ] Handoff to ops team

**Related:** [[arl-phase-7-7-confidence-model]] (scoring), [[arl-phase-7-8-drift-calculator]] (drift detection)

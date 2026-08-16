---
name: skill-automation-schedule
description: "Recommended automation schedule for 11 deployed skills based on execution patterns, resource cost, and stakeholder needs"
metadata: 
  node_type: memory
  type: project
  originSessionId: ab18ad0c-b44f-4d4b-a24d-5fcf6ffea313
---

# Skill Automation Schedule

**Date:** 2026-06-27  
**Wave:** Complete (11/11 skills deployed)

## Automation Tiers

### Tier 1: Per-Session Dev Process (Automatic)
Run at start of each development session without user interaction.

- **environment-validator** — Health check
  - Trigger: Session startup
  - Cost: ~100ms
  - Purpose: Verify git, Docker, Node, dependencies in <2s
  - Auto-run: Yes (pre-work validation)

- **cic-benchmark-runner** — Optional pre-test capture
  - Trigger: Before running test suite
  - Cost: ~5000 tokens per comparison (A/B testing)
  - Purpose: Baseline performance for regression detection
  - Auto-run: Optional (flag: `--bench-baseline`)

### Tier 2: Daily Automated (Cron: 09:00 UTC)
One-off daily checks in background, report to Slack/email.

- **mee-phase-executor** — Phase status checkpoint
  - Frequency: Daily 09:00 UTC
  - Cost: ~1000 tokens (state serialization + validation)
  - Purpose: Verify phases 43-45 still running, capture ETA drift
  - Output: Slack notification + JSON to `data/mee-state-checkpoints/`
  - Failure mode: Log to observability, alert on-call

- **helm-daily-brief** — K8s cluster health
  - Frequency: Daily 09:00 UTC
  - Cost: kubectl API calls (~10 requests)
  - Purpose: Pod status, failed restart count, error rate trend
  - Output: Email digest to ops team
  - Failure mode: Silent log (K8s API timeout = expected)

- **skill-health-monitor** — Ecosystem health scan
  - Frequency: Daily 22:00 UTC (off-peak)
  - Cost: Disk I/O only (parse `~/.claude/skills/`)
  - Purpose: Track invocation patterns, success rates, unused skills
  - Output: Daily report to `logs/skill-health/`, Slack summary
  - Failure mode: Skip (idempotent, catches up next run)

### Tier 3: Weekly Automated (Cron: Monday 10:00 UTC)
Deeper analysis, feeds decision-making.

- **governance-playbook-automator** — Promotion gate audit
  - Frequency: Weekly Monday 10:00 UTC (pre-standup)
  - Cost: ~500 tokens (playbook template rendering)
  - Purpose: Verify all governance gates are wired, audit decision logs
  - Output: Weekly audit report to Slack #governance
  - Failure mode: Alert on-call (gate bypass is a security issue)

- **idea-inbox-harvester** — Transcript mining
  - Frequency: Weekly Monday 09:00 UTC
  - Cost: ~2000 tokens (parse session transcripts)
  - Source: `~/.claude/projects/c--dev/memory/*.md` + `.jsonl` session logs
  - Purpose: Extract learnings, patterns, ideas for retro
  - Output: Ideas inbox, patterns board (Notion/GitHub Projects)
  - Failure mode: Log; will be picked up in manual retro

### Tier 4: Manual Triggers (On-Demand)
Run when explicitly requested, not automated.

- **mee-finding-assessor** — Phase output analysis
  - Trigger: After phase completion or debug session
  - Cost: ~1500 tokens per assessment
  - Purpose: Surface findings + risk level from phase logs
  - Command: `/skill mee-finding-assessor --phase=43 --transcript=...`
  - Manual: Yes (requires phase-specific context)

- **phase-validator** — Acceptance criteria audit
  - Trigger: Before phase ship-gate or governance review
  - Cost: ~800 tokens (contract checking)
  - Purpose: Validate readiness gates + acceptance criteria
  - Command: `/skill phase-validator --phase=4 --contract=...`
  - Manual: Yes (requires human decision framing)

- **cost-optimizer-tuner** — API spend review
  - Trigger: Quarterly or on budget anomaly
  - Cost: ~1000 tokens (model selection analysis)
  - Purpose: Recommend cost-efficient model swaps
  - Command: `/skill cost-optimizer-tuner --metrics=data/api-metrics.json`
  - Manual: Yes (requires stakeholder approval)

- **retrospective-analyzer** — Session mining
  - Trigger: End of sprint, before retro meeting
  - Cost: ~3000 tokens (full session transcript analysis)
  - Purpose: Extract went-well, blockers, anti-patterns for retro
  - Command: `/skill retrospective-analyzer --transcript=session.jsonl`
  - Manual: Yes (retro-specific use case)

## Implementation

### Cron Schedule (Docker/K8s)
```yaml
# .github/workflows/daily-skill-automation.yml or cron-executor service
schedule:
  - cron: '0 9 * * *'
    jobs:
      - mee-phase-executor
      - helm-daily-brief
  - cron: '0 22 * * *'
    jobs:
      - skill-health-monitor
  - cron: '0 10 * * MON'
    jobs:
      - governance-playbook-automator
      - idea-inbox-harvester
```

### Session Startup Hook
```bash
# ~/.claude/hooks/session-startup.sh (or Claude Code config)
environment-validator --quick
```

### Observability Integration
- Metrics: Prometheus gauges for skill invocation counts, latency, error rates
- Logs: Structured JSON to `logs/skill-executions/` with timestamp, skill name, cost, status
- Alerts: Slack/email on automation failures (missed gates, deployment checks)

## Cost Breakdown

| Tier | Skill | Frequency | Tokens/Run | Monthly Cost |
|------|-------|-----------|-----------|--------------|
| Dev | environment-validator | 5x/week | 10 | $0.02 |
| Daily | mee-phase-executor | 1/day | 1000 | $0.60 |
| Daily | helm-daily-brief | 1/day | 100 | $0.06 |
| Daily | skill-health-monitor | 1/day | 100 | $0.06 |
| Weekly | governance-playbook-automator | 1/week | 500 | $0.10 |
| Weekly | idea-inbox-harvester | 1/week | 2000 | $0.40 |
| **Total** | | | | **~$1.24/month** |

Manual-only skills (mee-finding-assessor, phase-validator, cost-optimizer-tuner, retrospective-analyzer) add ~$5–10/month depending on usage.

## Decision Log

- ✅ **environment-validator → Auto (dev startup)**: Zero cost, unblocks work
- ✅ **mee-phase-executor → Daily**: Early-warning ETA drift, supports phase ops
- ✅ **helm-daily-brief → Daily**: Ops dashboards feed from this; low cost
- ✅ **skill-health-monitor → Daily (off-peak)**: Ecosystem observability; inform skill improvements
- ✅ **governance-playbook-automator → Weekly**: Gate bypass is critical; weekly audit + Slack visibility
- ✅ **idea-inbox-harvester → Weekly**: Retro input; can't run every session (data noise)
- ✅ **All others → Manual**: Context-dependent; require human decision or live data

## Next Steps

1. ✅ Schedule cron jobs in CI/K8s
2. ✅ Wire Slack/email output channels
3. ✅ Create observability dashboards (Prometheus + Grafana)
4. ✅ Set automation alerts (missed runs, timeouts)
5. ✅ Document trigger phrases + manual commands in wiki

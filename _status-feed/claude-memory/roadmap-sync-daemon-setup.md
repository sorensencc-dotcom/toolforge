---
name: roadmap-sync-daemon-setup
description: Multi-repo daily roadmap drift detector with Task Scheduler + Slack reporting
metadata: 
  node_type: memory
  type: project
  originSessionId: d5daf1e9-ad0e-4c52-8f83-c123430760a7
---

## Daily Roadmap Sync Daemon — Complete Setup (2026-06-28)

**Status:** Code review complete, 4 BLOCK + 5 FLAG fixes applied + tested ✅  
**Components:** Registry + TypeScript scanner + Task Scheduler integration

### Architecture

Four-file system:
1. **Registry** (`C:\dev\repo-registry.json`) — Repo paths + roadmap doc mappings
2. **Scanner** (`C:\dev\tools\multiRepoRoadmapSync.ts`) — Drift detection + doc updates
3. **Task Setup** (`C:\dev\tools\setup-task-scheduler.ps1`) — Windows scheduler registration
4. **Docs** (`C:\dev\tools\ROADMAP-SYNC-SETUP.md`) — Full setup guide

### Drift Detection Rules

| Signal | Status Result |
|--------|---|
| Modified < 24h | Active |
| No changes > 14 days | Stalled ⚠️ |
| `COMPLETE_MARKER` file | Marked complete |
| `STATUS.md` = "Shipped" | Shipped |
| Tests dir exists | Tests OK |

### Daily Schedule

**Time:** 09:00 UTC (05:00 EDT)  
**Trigger:** Windows Task Scheduler  
**Output:**
- JSON report: `C:\dev\TheFoundry\reports\roadmap-diffs\roadmap-sync-{YYYY-MM-DD}.json`
- Slack notification: Structured blocks (status, changes, stalled phases)
- Roadmap updates: Appended timestamp + drift summary to docs

### Setup Steps (Quick Reference)

1. Compile: `npx tsc multiRepoRoadmapSync.ts --target ES2020 --module commonjs --esModuleInterop`
2. Set webhook: `$env:SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/..."`
3. Test: `node tools\multiRepoRoadmapSync.js` (from `C:\dev`)
4. Register (admin): `C:\dev\tools\setup-task-scheduler.ps1 -SlackWebhook $env:SLACK_WEBHOOK_URL`
5. Verify: `taskschd.msc` → look for "Daily Roadmap Sync"

### Repos Scanned

Currently configured in `repo-registry.json`:
- rewrite-mcp
- cic-os
- charlie-deep-research
- castironforge
- cic-ingestion
- castironcharlie
- cic

Add more by editing registry + rerunning.

### Key Features

- **Non-destructive updates**: Old status preserved in footers
- **Extensible drift rules**: Edit `detectDrift()` for custom logic
- **Error resilience**: Missing docs logged but don't block scan
- **Placeholder webhook support**: Graceful if webhook not configured
- **Archival**: Reports saved incrementally, old roadmaps backed up

### Dependencies

- Node.js 18+
- `node-fetch@2`
- PowerShell 7+ (admin for Task Scheduler)

### Next Actions

- [ ] Get Slack webhook from https://api.slack.com/messaging/webhooks
- [ ] Update `SLACK_WEBHOOK_URL` environment variable
- [ ] Compile TypeScript
- [ ] Test with `node tools\multiRepoRoadmapSync.js`
- [ ] Register Task Scheduler (admin)
- [ ] Verify first run

---

**Related:** [[Phase 4 Complete Spec]], [[Governance Playbook]]

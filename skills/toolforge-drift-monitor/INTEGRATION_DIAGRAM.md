# Toolforge Drift Monitor — Integration Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Multi-System Drift Detection                           │
└─────────────────────────────────────────────────────────┘

Canonical              Distributed            Manifest
   │                      │                      │
   ├──[SKILL.json]────────┼──────────────────────┼────> Check hashes
   │                      │                      │
   └──[entrypoint]────────┼──────────────────────┘
                          │
                    Cowork Registry ──> Check registration
                          │
                          └──> Runtime Discovery ──> Check discoverable

┌──────────────────────────────────────────┐
│ toolforge-drift-monitor Flow             │
└──────────────────────────────────────────┘

Daily 09:00 UTC (Task Scheduler):
  1. Scan canonical/ for all skills
  2. Check distributed/ has all skills + versions match
  3. Check manifest.json has all skills
  4. Check Cowork registry has all active skills
  5. Check runtime discovery works for all skills
  6. Report gaps to Slack webhook

Drift Types:
  - Version mismatch (manifest ≠ canonical)
  - Missing distributed (canonical not synced)
  - Missing manifest entry (canonical not indexed)
  - Missing Cowork registration (skill not registered)
  - Not discoverable (entrypoint missing or invalid)


┌────────────────────────────────────────────┐
│ Integration Points                        │
└────────────────────────────────────────────┘

Reads from:
  - C:\dev\toolforge\skills\*\SKILL.json
  - C:\dev\rewrite-mcp\toolforge\skills\*\SKILL.json
  - C:\dev\toolforge\manifest.json
  - C:\dev\toolforge\audit\COWORK-REGISTERED-SKILLS.md

Notifies:
  - Slack webhook (on drift detected)
  - SLACK_WEBHOOK_URL env var required
```

## Dependencies

- PowerShell Task Scheduler (for scheduling)
- Slack webhook (for notifications)
- `toolforgeSkillValidator.ps1` (for validation logic)

## Inputs

- Canonical: `C:\dev\toolforge\skills/`
- Distributed: `C:\dev\rewrite-mcp\toolforge\skills/`
- Manifest: `C:\dev\toolforge\manifest.json`

## Outputs

- Slack notification (on drift)
- Optional: `DRIFT-REPORT.md` log file

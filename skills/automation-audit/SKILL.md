---
skill_name: automation-audit
version: 1.0.0
name: automation-audit
category: operations
description: Repository-wide scan for manual tasks that should be automated
author: Soren (Cast Iron Forge)
tags: ["automation", "devops-audit", "log-rotation", "backup-retention"]
---

# Automation Audit

**Status: ACTIVE**
**Version: 1.0.0**
**Category: operations**
**Owner: soren**

---

## Purpose

Read-only scan of a repository for tasks that should be automated but currently
require manual intervention: oversized logs needing rotation, backup/archive
folders needing a retention policy, and scripts with manual-step markers
(`TODO`, `manual`) that should be scheduled.

Migrated from `~/.claude/skills/automation-audit.md` (global). No overlap found with
any existing toolforge skill during triage — this is genuinely new coverage, not a
reinvention.

## v1.0.0 Changes (deep review)

The global v0 skill was hardcoded to `C:\CIC_MEDIA_LIBRARY`, invoked only via
PowerShell scripts (`scan-automation-opportunities.ps1`) that don't exist in this
repo, and its schedule/task-registry integration pointed at infrastructure specific
to that other project. This rewrite:

- Takes `repoRoot` as a parameter (default: cwd) instead of a hardcoded path
- Is pure Node/TypeScript — runs the same on Windows/macOS/Linux, no PowerShell dependency
- Drops the CIC_MEDIA_LIBRARY-specific "Data Sync" / "Versioning" / DB-row-count
  scan categories that had no implementation to migrate — kept only the categories
  that were fully specified and implementable: log rotation, backup retention,
  manual-step markers
- Report-generation only; does not assume a `task-registry.json` or Windows Task
  Scheduler exist in the target repo

## Inputs

| Field | Type | Default |
| --- | --- | --- |
| `repoRoot` | string | cwd |
| `logSizeMB` | number | 10 |
| `backupItemThreshold` | number | 10 |
| `manualMarkerPattern` | RegExp source | `/\b(TODO\|manual)\b/i` |
| `excludeDirs` | string[] | `node_modules, .git, dist, build` |

## Output

```
{
  scanTimestamp: ISO 8601,
  repoRoot: string,
  totalOpportunities: number,
  byPriority: { high, medium, low },
  byCategory: object,
  opportunities: [{
    category, priority, task, path, details, suggestedFrequency
  }]
}
```

## Categories Scanned

1. **log_rotation** — `.log` files over `logSizeMB`; high priority above 5x threshold
2. **backup_management** — dirs named `backup*`/`archive*`/`_archive*` with more than
   `backupItemThreshold` immediate children
3. **manual_step** — script files (`.ps1`, `.sh`, `.js`, `.ts`, `.py`) matching
   `manualMarkerPattern`

## Notes

- Scans are strictly read-only.
- Depth-limited traversal, `excludeDirs` skipped entirely (no recursion into them).
- Run manually or on a schedule; this skill does not register its own schedule.

## See Also

- `docs/USAGE.md`

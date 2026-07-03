# Toolforge Drift Detection Report

**Generated**: 2026-06-28T15:23:34.9620055Z

**Canonical**: C:\dev\toolforge
**Distributed**: C:\dev\rewrite-mcp\toolforge

---

## Executive Summary

| Category | Drifts | Severity |
|----------|--------|----------|
| Structure | 2 | ⚠️ |
| Tools | 0 | ✓ |
| Skills | 2 | ⚠️ |
| Docs | 0 | ✓ |
| Manifest | 5 | ⚠️ |

**Total Drifts**: 9
**Status**: ⚠️ DRIFTED

---

## Findings
### Structure Drifts

- **missing** new-skills-pending-install (in distributed)
- **missing** roadmap-validator (in distributed)

### Skills Drifts

- **skills/**: missing in distributed
- **roadmap-validator**: missing_skill

### Manifest Drifts

- **manifest.skills**: count mismatch (canonical: 2, distributed: 0)

---

## Remediation

### For Missing Items in Distributed

1. Run sync tool: \./toolforgeSkillSync.ps1\
2. Verify distributed has all items from canonical
3. Test tools/skills in distributed location

### For Version Mismatches

1. Update distributed manifest.json version to match canonical
2. Run \./run-tool.ps1 -Refresh\ in distributed
3. Verify version consistency

### For Extra Items in Distributed

If unexpected items exist in distributed:
1. Verify they are intentional (development branches, local experiments)
2. Document in DRIFT-NOTES.md
3. No action required if temporary

---

## Detection Rules

- **Structure**: Canonical directory structure should exist in distributed
- **Tools**: All tools in canonical sync-tools/ should exist in distributed
- **Skills**: All skills in canonical skills/ should exist in distributed
- **Versions**: skill.json versions must match between canonical and distributed
- **Manifest**: manifest.json versions and skill counts should match

---

## Schedule

This detector runs daily at **09:00 UTC** via Task Scheduler.

Reports are appended to this file with dated entries.

---

**Drift Detection v1.0.0** | Toolforge Team

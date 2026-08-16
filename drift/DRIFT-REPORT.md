# Toolforge Drift Detection Report

**Generated**: 2026-08-16T15:55:39.2935792Z

**Canonical**: C:\dev
**Distributed**: C:\dev\rewrite-mcp\toolforge

---

## Executive Summary

| Category | Drifts | Severity |
|----------|--------|----------|
| Structure | 45 | WARN |
| Tools | 0 | OK |
| Skills | 2 | WARN |
| Docs | 0 | OK |
| Manifest | 0 | OK |

**Total Drifts**: 47
**Status**: DRIFTED

---

## Findings
### Structure Drifts

- **missing** _status-feed (in distributed)
- **missing** .cursor (in distributed)
- **missing** .gemini (in distributed)
- **missing** .nlm_pack (in distributed)
- **missing** .windsurf (in distributed)
- **missing** assets (in distributed)
- **missing** audit (in distributed)
- **missing** cic (in distributed)
- **missing** CIC-GOVERNANCE (in distributed)
- **missing** cic-ingestion (in distributed)
- **missing** cic-vision-governance (in distributed)
- **missing** config (in distributed)
- **missing** data (in distributed)
- **missing** dlq (in distributed)
- **missing** drift (in distributed)
- **missing** engines (in distributed)
- **missing** gateway (in distributed)
- **missing** governance (in distributed)
- **missing** graft (in distributed)
- **missing** health (in distributed)
- **missing** kb-sync (in distributed)
- **missing** memory (in distributed)
- **missing** modules (in distributed)
- **missing** operations (in distributed)
- **missing** post_seal_ops (in distributed)
- **missing** rewrite-docs (in distributed)
- **missing** roadmap-runner (in distributed)
- **missing** scripts (in distributed)
- **missing** services (in distributed)
- **missing** sigil (in distributed)
- **missing** sigil-npm-cache (in distributed)
- **missing** sigil-package-test (in distributed)
- **missing** sigil-repo (in distributed)
- **missing** src (in distributed)
- **missing** task-observatory (in distributed)
- **missing** tests (in distributed)
- **missing** TheFoundry (in distributed)
- **missing** toolforge (in distributed)
- **missing** toolforge-pdf (in distributed)
- **missing** trm (in distributed)
- **missing** windows-task-manager (in distributed)
- **extra** adapters (in distributed)
- **extra** mcp-servers (in distributed)
- **extra** prototypes (in distributed)
- **extra** scaffolds (in distributed)

### Skills Drifts

- **kb-sync-nightly**: version mismatch (canonical: 1.0.2, distributed: 1.0.0)
- **obsidian-ingest-wiki**: version mismatch (canonical: 1.1.0, distributed: 1.0.0)

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

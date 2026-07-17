---
skill_name: skill-health-monitor
version: 1.0.0
name: skill-health-monitor
category: monitoring
description: Manifest-driven ecosystem health — staleness, never-run skills, manifest/directory drift
author: Soren (Cast Iron Forge)
tags: ["skill-health", "manifest-audit", "staleness", "inventory"]
---

# Skill Health Monitor

**Status: ACTIVE**
**Version: 1.0.0**
**Category: monitoring**
**Owner: soren**

---

## Purpose

Report ecosystem health for `toolforge/skills` using data that actually exists in
this repo: `manifest.json` timestamps and the skills directory listing. No invocation
telemetry exists yet, so this does **not** report invocation counts, success rates,
or trigger-phrase accuracy — those fields would be fabricated.

Migrated from `~/.claude/skills/skill-health-monitor.md` (global). The global v1.0
stub returned hardcoded example metrics (`deploy-skill: 145 invocations...`) for
*any* input — it never touched a real manifest. This rewrite reports only what the
manifest and filesystem can support today, and each field is traceable to a source.

## Distinct from `rewrite-docs/scripts/skill-health-monitor.ts`

That script is a **structural linter**: per-skill-directory checks for required
files (`skill.json`, `SKILL.md`), valid `entrypoint`, valid `category`. This skill is
an **ecosystem-level manifest audit**: staleness, never-run skills, and drift between
`manifest.json` entries and the actual `toolforge/skills/` directory listing. Same
general "health" name, different layer — kept separate rather than merged, since one
is a per-file build gate and the other is a fleet-status report.

## Inputs

| Field | Type | Default |
| --- | --- | --- |
| `manifestPath` | string | `toolforge/manifest.json` |
| `skillsDir` | string | `toolforge/skills` |
| `staleDays` | number | `30` |

## Outputs

```
{
  reportDate: ISO 8601,
  totalSkills: number,
  neverRun: string[],              // lastRun === null
  stale: string[],                 // lastValidation older than staleDays (or null)
  orphanedManifestEntries: string[], // manifest id has no matching skills/ dir
  unregisteredDirs: string[],      // skills/ dir has no matching manifest entry
  healthScore: number,             // 100 - penalties for drift/staleness
  recommendations: string[]
}
```

## Health Score

Starts at 100. Deductions:
- `-15` per orphaned manifest entry (points at a directory that doesn't exist)
- `-10` per unregistered directory (skill exists but isn't in the inventory)
- `-2` per stale skill (capped at -20)
- `-1` per never-run skill (capped at -10)

Floors at 0.

## Implementation

**Location:** `src/index.ts`
**Dependencies:** Node.js `fs`, `path`
**Execution:** load manifest → list `skillsDir` → diff → score → recommend

## See Also

- `docs/USAGE.md`
- `toolforge/manifest.json` — data source
- `rewrite-docs/scripts/skill-health-monitor.ts` — the structural-lint sibling

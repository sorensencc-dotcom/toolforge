# Toolforge Documentation Index

Friendly map of what's actually under `C:\dev\docs` right now — navigation first, no invented tools.

**Generated**: 2026-09-07  
**Scope**: Local docs tree on this machine (not a GitHub scrape)  
**Toolforge root note**: a root-level toolforge folder is **not** present. The Toolforge repo / workspace root is **`C:\dev`** (`manifest.json`, `run-tool.ps1`, `Home.md`, etc. live there). Docs for tools live here under `C:\dev\docs`.

---

## What this folder is for

`C:\dev\docs` is the working documentation hub: classic Toolforge tool writeups, platform governance/meta, daily reports, design plans, gateway notes, and a bit of archive/logs. Use this index to find the right subdirectory, then open the linked markdown.

If you only need machine-readable skill inventory, prefer `C:\dev\manifest.json` (51 active skills as of this refresh) over the older five-tool list below.

---

## Quick start

| I want to... | Go here |
|---|---|
| Find a classic sync/daemon/utility doc | [Classic tool docs](#classic-tool-docs-still-on-disk) |
| Read governance / phases / specs / plans | [`meta/`](meta/README.md) |
| Skim daily or weekly status | [`reports/`](reports/) |
| Find design + implementation pairs | [`superpowers/`](superpowers/) |
| Cowork gateway notes | [`gateway/`](gateway/) |
| Marketplace registry / schema notes | [`toolforge/`](toolforge/) |
| Rollback / KB sync ops | [`ROLLBACK_RUNBOOK.md`](ROLLBACK_RUNBOOK.md), [`KB_SYNC_DAG.md`](KB_SYNC_DAG.md) |
| Publishing ownership for a few root docs | [`documentation-publishing.json`](documentation-publishing.json) |

---

## Docs tree (on disk, Sep 2026)

Top-level under `C:\dev\docs` (skipping `.tmp.*` Drive sync folders):

| Path | Role | Approx. markdown count |
|---|---|---|
| [`sync-tools/`](sync-tools/) | Classic sync-tool docs | 1 |
| [`daemons/`](daemons/) | Classic daemon docs | 4 |
| [`utilities/`](utilities/) | Classic utility docs | 18 |
| [`toolforge/`](toolforge/) | Marketplace registry, schema, integration notes | 2 (+ json/ps1) |
| [`gateway/`](gateway/) | Cowork gateway charters / mock API | 2 |
| [`wave-d/`](wave-d/) | Wave D load-test / trending scheduler notes | 2 |
| [`meta/`](meta/) | Governance, phases, specs, plans, reviews, audit | ~124 |
| [`superpowers/`](superpowers/) | Dated plans + design specs | ~40 |
| [`reports/`](reports/) | Daily + weekly reports (+ one audit) | ~41 |
| [`logs/`](logs/) | Build/storybook log files (not markdown docs) | 0 md |
| [`archive/`](archive/) | Archived projects (includes old castironforge tree) | many (mostly archive) |
| Root files | This index, runbooks, publishing config | 3 md + 1 json |

**Category folders present**: 11 (`archive`, `daemons`, `gateway`, `logs`, `meta`, `reports`, `superpowers`, `sync-tools`, `toolforge`, `utilities`, `wave-d`).

---

## Classic tool docs (still on disk)

Classic sync/daemon docs plus an expanded `utilities/` set still exist on disk. Matching scripts also still live under `C:\dev\daemons`, `C:\dev\sync-tools`, and `C:\dev\utilities`. They are **not** listed as skills in `C:\dev\manifest.json` today — treat status as "docs + scripts present; not in the skill manifest."

### Sync-tools

#### [multiRepoRoadmapSync](sync-tools/multiRepoRoadmapSync.md)

Unified drift detector + roadmap updater for sorensencc-dotcom repos.

- **Version** (per doc): 0.1.0  
- **Doc status**: present  
- **Script location**: `C:\dev\sync-tools\multiRepoRoadmapSync.cjs` (also `.ts`)  
- **Schedule** (per doc): Daily 09:00 UTC  
- **Deps** (per doc): Node.js 20+, PowerShell 7+

```powershell
# From Toolforge root (C:\dev), when run-tool wiring still applies:
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config repo-registry.json
```

### Daemons

| Doc | Purpose (short) | Script on disk |
|---|---|---|
| [toolforgeManifestSync](daemons/toolforgeManifestSync.md) | Rescan categories; update `manifest.json` | `C:\dev\daemons\toolforge-manifest-sync.ps1` |
| [toolforgeDocsSync](daemons/toolforgeDocsSync.md) | Regenerate tool markdown / index docs | `C:\dev\daemons\toolforge-docs-sync.ps1` |
| [toolforgeIndexSync](daemons/toolforgeIndexSync.md) | Build human-readable tool index from manifest | `C:\dev\daemons\toolforge-index-sync.ps1` |
| [coworkAutoSync](daemons/coworkAutoSync.md) | Align Cowork registry with canonical skills | `C:\dev\daemons\cowork-auto-sync.ps1` |


Four daemon docs on disk (including cowork auto-sync). Daemon docs point generated markdown at this `C:\dev\docs` tree. Older historical notes under `meta/` may still mention `the old root-level toolforge folder\docs\...` - that path does **not** exist as a workspace root.

### Utilities

| Doc | Script on disk | Purpose (short) |
|---|---|---|
| [setupTaskScheduler](utilities/setupTaskScheduler.md) | `setup-task-scheduler.ps1` | Register/remove/test classic Toolforge scheduled tasks |
| [nodeProcessJanitor](utilities/nodeProcessJanitor.md) | `node-process-janitor.ps1` | Dry-run-first cleanup of orphan Node / git fsmonitor processes |
| [runTool](utilities/runTool.md) | `run-tool.ps1` | Discover/select active skills from `manifest.json` |
| [toolforgeDriftDetector](utilities/toolforgeDriftDetector.md) | `toolforgeDriftDetector.ps1` | Skill / tree drift detection |
| [toolforgeSkillHealthCheck](utilities/toolforgeSkillHealthCheck.md) | `toolforgeSkillHealthCheck.ps1` | Skill health checks |
| [toolforgeSkillInstaller](utilities/toolforgeSkillInstaller.md) | `toolforgeSkillInstaller.ps1` | Skill install helper |
| [toolforgeSkillValidator](utilities/toolforgeSkillValidator.md) | `toolforgeSkillValidator.ps1` | Multi-system skill validation pack |
| [bumpVersion](utilities/bumpVersion.md) | `bump-version.ps1` | Semver bump for `VERSION.md` (+ GITHUB_OUTPUT) |
| [generateChangelog](utilities/generateChangelog.md) | `generate-changelog.ps1` | Prepend changelog section from git since last tag |
| [initRunStore](utilities/initRunStore.md) | `init-run-store.ps1` | Idempotent SQLite `run-store.db` init/migrate |
| [invokeCoworkSkillInstall](utilities/invokeCoworkSkillInstall.md) | `Invoke-CoworkSkillInstall.ps1` | Register a skill into Cowork with audit logs |
| [roadmapConsolidationScanner](utilities/roadmapConsolidationScanner.md) | `roadmap-consolidation-scanner.ps1` | Audit all ROADMAP.md -> dated JSON report |
| [roadmapDriftChecker](utilities/roadmapDriftChecker.md) | `roadmap-drift-checker.ps1` | Weekly forbidden-location ROADMAP drift scan |
| [roadmapMigrationHelper](utilities/roadmapMigrationHelper.md) | `roadmap-migration-helper.ps1` | Dry-run-first copy of canonical roadmaps to roots |
| [roadmapOrphanCleanup](utilities/roadmapOrphanCleanup.md) | `roadmap-orphan-cleanup.ps1` | Delete orphan roadmaps from audit (or legacy scan) |
| [skillDocValidator](utilities/skillDocValidator.md) | `skill-doc-validator.ps1` | README/SKILL.md Operator Guide compliance checks |
| [toolforgeDependencyGraph](utilities/toolforgeDependencyGraph.md) | `toolforgeDependencyGraph.ps1` | Skill dependency graph markdown (Phase 1.4) |
| [toolforgeMetadataGenerator](utilities/toolforgeMetadataGenerator.md) | `toolforgeMetadataGenerator.ps1` | Skillpack metadata JSON + summary (Phase 1.5) |

```powershell
& "C:\dev\utilities\setup-task-scheduler.ps1" -Install
```

Skip `C:\dev\utilities\tests\` when documenting or inventorying utilities. All four daemons under `docs/daemons/` (including coworkAutoSync) are documented.

### Classic quick reference

| Tool | Docs category | Type | Schedule (per doc) |
|---|---|---|---|
| multiRepoRoadmapSync | sync-tools | Multi-repo scanner | Daily 09:00 UTC |
| toolforgeManifestSync | daemons | Background daemon | Every 15 min |
| toolforgeDocsSync | daemons | Background daemon | On-demand |
| toolforgeIndexSync | daemons | Background daemon | On-demand |
| coworkAutoSync | daemons | Background daemon | Scheduled / on-demand |
| setupTaskScheduler | utilities | Setup tool | N/A (one-time) |

**Classic documented tools on disk**: sync-tools (1) + daemons (4) + a fuller utilities set (18 docs). The quick table above is a sample, not the full utilities list.

---

## Platform & governance (`meta/`)

Start at [`meta/README.md`](meta/README.md). Placement rules: [`meta/governance/documentation-policy.md`](meta/governance/documentation-policy.md).

| Subfolder | What's inside |
|---|---|
| [`meta/governance/`](meta/governance/) | Durable rules, policies, gates, marketplace spec |
| [`meta/phases/`](meta/phases/) | Phase charters, completion/handoff notes (Toolforge, IronLedger, etc.) |
| [`meta/specs/`](meta/specs/) | Design / integration specs |
| [`meta/plans/`](meta/plans/) | Implementation plans |
| [`meta/reviews/`](meta/reviews/) | Review writeups |
| [`meta/audit/`](meta/audit/) | Audit docs |
| [`meta/archive/`](meta/archive/) | Superseded meta docs |
| [`meta/phase-8-toolforge-marketplace/`](meta/phase-8-toolforge-marketplace/) | Marketplace deliverables (manifest schema, registry, CLI, validator) |

Useful root-level meta notes also include platform roadmaps, skill operator guide, and IronLedger dependency posture.

---

## Plans & designs (`superpowers/`)

Dated pairs of implementation plans and design specs (TRM, Sigil, NotebookLM ingest, wiki QA, documentation publishing governance, Toolforge↔Herdr/TRM integration, and more).

- Plans: `superpowers/plans/`
- Specs: `superpowers/specs/`

Roughly 40 markdown files; newest activity through early Sep 2026.

---

## Reports (`reports/`)

- **Daily**: `reports/daily/` — ~34 files; latest on disk through `2026-09-06.md`
- **Weekly**: `reports/weekly/` — `2026-W29`, `W30`, `W33`–`W36`
- **Other**: [`reports/production-promotion-audit.md`](reports/production-promotion-audit.md)

---

## Gateway, Wave D, Toolforge marketplace folder

### [`gateway/`](gateway/)

- [`cowork-mock-api.md`](gateway/cowork-mock-api.md)
- [`phase-3c-kickoff-charter.md`](gateway/phase-3c-kickoff-charter.md)

### [`wave-d/`](wave-d/)

- [`LOAD-TEST.md`](wave-d/LOAD-TEST.md)
- [`TRENDING-SCHEDULER.md`](wave-d/TRENDING-SCHEDULER.md)

### [`toolforge/`](toolforge/) (docs copy — not the missing a root-level toolforge folder root)

- [`registry.json`](toolforge/registry.json) — marketplace registry (1 published plugin: `trm-status`, generated 2026-08-01)
- [`schemas/skill.marketplace.schema.json`](toolforge/schemas/skill.marketplace.schema.json)
- [`validators/manifest-validator.ps1`](toolforge/validators/manifest-validator.ps1)
- [`INTEGRATION-TEST.md`](toolforge/INTEGRATION-TEST.md), [`WAVE-D-COMPLETION.md`](toolforge/WAVE-D-COMPLETION.md), `integration-test.ps1`

Published skill path referenced by the registry: `C:\dev\skills\trm-status` (present).

---

## Root ops docs

| File | Purpose |
|---|---|
| [`DOCS_INDEX.md`](DOCS_INDEX.md) | This navigation index |
| [`ROLLBACK_RUNBOOK.md`](ROLLBACK_RUNBOOK.md) | Rollback procedures |
| [`KB_SYNC_DAG.md`](KB_SYNC_DAG.md) | KB sync DAG notes |
| [`documentation-publishing.json`](documentation-publishing.json) | Publishing entries for docs-index, rollback-runbook, kb-sync-dag |

---

## Archive & logs

- [`archive/projects/`](archive/projects/) — archived project trees (e.g. castironforge). Expect heavy `node_modules` noise; not day-to-day reading.
- [`logs/`](logs/) — leftover storybook build logs from 2026-06-25.

---

## Reserved / missing categories (honest)

The old index reserved these Toolforge categories. On this machine:

| Category | Under `C:\dev\` | Under `C:\dev\docs\` |
|---|---|---|
| adapters/ | missing | missing |
| mcp-servers/ | missing | missing |
| scaffolds/ | missing | missing |
| prototypes/ | missing | missing |

Do not treat them as active docs locations until folders (and docs) actually appear.

---

## How a typical tool doc is structured

When present, classic tool pages usually include purpose, inputs, outputs, behavior, dependencies, entrypoint, configuration, schedule, error handling, examples, notes, and see-also links.

---

## Discovery commands (Toolforge root = `C:\dev`)

Prefer the utilities skills launcher (root `.\run-tool.ps1` points at missing a root-level toolforge folder and is legacy/broken for this layout):

```powershell
cd C:\dev
& ".\utilities\run-tool.ps1" -ListOnly
& ".\utilities\run-tool.ps1" -SkillId "<skill-id>" -Verbose
```

Skill-oriented inventory:

```powershell
# Machine-readable skills (51 active in manifest at last check)
Get-Content C:\dev\manifest.json | ConvertFrom-Json | Select-Object -ExpandProperty skills
```

---

## Links that moved or are missing

Old index "See Also" / contributing links assumed wiki-style names or `the old root-level toolforge folder\...`. Current reality:

| Old reference | Status on this machine |
|---|---|
| `the old root-level toolforge folder\...` | **Missing** — use `C:\dev` as repo root; docs under `C:\dev\docs` |
| `Home`, `OPERATOR_GUIDE`, `GOVERNANCE`, `TOOL_CREATION_GUIDE`, `INDEX` (bare names) | **Not** under `C:\dev\docs`; **are** present at `C:\dev\Home.md`, `C:\dev\OPERATOR_GUIDE.md`, `C:\dev\GOVERNANCE.md`, `C:\dev\TOOL_CREATION_GUIDE.md`, `C:\dev\INDEX.md` (note: `INDEX.md` is currently an Ollama/staging evidence-gate doc, not a pure tool catalog) |
| GitHub `manifest.json` URL | Not used by this refresh (local disk only; GitHub MCP unavailable) |
| `TOOL_CREATION_GUIDE` under docs | Use `C:\dev\TOOL_CREATION_GUIDE.md` |

---

## Contributing / refreshing docs

1. Prefer placing new platform docs under the right `meta/` bucket (see documentation policy).
2. Classic per-tool pages still belong under `docs/<category>/<tool>.md` when you document a Toolforge category tool.
3. After structural changes, refresh this `DOCS_INDEX.md` so the map matches disk again.
4. `toolforgeDocsSync` / related daemons may still help generate tool pages — verify output paths against `C:\dev\docs` (not the absent `the old root-level toolforge folder\docs`).

---

## See also (local paths that exist)

- [`C:\dev\Home.md`](../Home.md) — Toolforge overview (repo root)
- [`C:\dev\OPERATOR_GUIDE.md`](../OPERATOR_GUIDE.md) — How to run tools
- [`C:\dev\GOVERNANCE.md`](../GOVERNANCE.md) — Tool standards
- [`C:\dev\TOOL_CREATION_GUIDE.md`](../TOOL_CREATION_GUIDE.md) — Create new tools
- [`C:\dev\manifest.json`](../manifest.json) — Machine-readable skill/tool registry
- [`meta/skill-operator-guide.md`](meta/skill-operator-guide.md) — Skill operator guide
- [`meta/toolforge-platform-roadmap.md`](meta/toolforge-platform-roadmap.md) — Platform roadmap

---

*Refreshed from local disk inventory on 2026-09-07. Previous index preserved as `DOCS_INDEX.md.bak`.*


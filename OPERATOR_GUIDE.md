# Toolforge Operator Guide

Friendly, skills-first entrypoint for running and finding things on this machine.

**Workspace root**: `C:\dev` (there is no `C:\dev\toolforge` folder).
**Live inventory**: about 51 active skills in `C:\dev\manifest.json`.
**Last aligned to disk**: 2026-09-07

If you only remember one launcher, use `C:\dev\utilities\run-tool.ps1`. Skip the root `C:\dev\run-tool.ps1` (legacy/broken for the current layout - details below).

---

## Quick start (skills)

Skills live under `C:\dev\skills\<id>\` with `SKILL.md` + `README.md`. Deep workflow notes belong in `docs\USAGE.md` per skill (see the Skill Operator Guide).

### List active skills

```powershell
cd C:\dev
& ".\utilities\run-tool.ps1" -ListOnly
```

That reads `C:\dev\manifest.json` and prints active skills (name, category, description, tags).

### Inspect / target one skill

```powershell
& "C:\dev\utilities\run-tool.ps1" -SkillId "roadmap-validator" -Verbose
```

Interactive menu (no flags):

```powershell
& "C:\dev\utilities\run-tool.ps1"
```

### Honest note on execution

`docs\utilities\runTool.md` is the canonical writeup. The utilities launcher is great for **discovery and selection**. Runtime branches currently print a success-style message; they do **not** yet call `npx ts-node`, `node`, or `& $entrypointPath` (those lines are still stubbed/commented). Until execution is wired, treat `-SkillId` as "resolve + confirm entrypoint path exists," then run the skill entrypoint yourself if you need a real run.

### Manifest peek (machine-readable)

```powershell
$m = Get-Content C:\dev\manifest.json -Raw | ConvertFrom-Json
$m.skills | Where-Object status -eq "active" | Select-Object id, name, category, entrypoint, runtime | Format-Table -AutoSize
```

Expect roughly **51** active entries. Skill folders: `C:\dev\skills\<id>\`.

---

## Where the docs live

| Need | Go here |
| --- | --- |
| Docs map for this machine | [`docs\DOCS_INDEX.md`](docs/DOCS_INDEX.md) |
| Skill authoring / README-SKILL-USAGE contract | [`docs\meta\skill-operator-guide.md`](docs/meta/skill-operator-guide.md) |
| Utilities launcher details | [`docs\utilities\runTool.md`](docs/utilities/runTool.md) |
| Per-skill deep workflow | `C:\dev\skills\<id>\docs\USAGE.md` (expected; many skills already have it) |
| Platform overview | [`Home.md`](Home.md) |
| Standards / categories (governance text) | [`GOVERNANCE.md`](GOVERNANCE.md) |
| Machine-readable skill registry | [`manifest.json`](manifest.json) |

**Not a tool catalog:** root [`INDEX.md`](INDEX.md) is an Ollama/staging evidence-gate doc. For tools and skills, use `docs\DOCS_INDEX.md` + `manifest.json`.

---

## Warning: root `run-tool.ps1` is legacy / broken

| Launcher | Path | Status |
| --- | --- | --- |
| **Use this** | `C:\dev\utilities\run-tool.ps1` | Live skills launcher (`-ListOnly` / `-SkillId`; reads `C:\dev\manifest.json`) |
| **Avoid this** | `C:\dev\run-tool.ps1` | Classic category runner. It sets `TOOLFORGE_ROOT` to `C:\dev\toolforge`, which **does not exist** on this machine. Older docs that show `.\run-tool.ps1 -List` / `-Run` / `-Inspect` / `-Refresh` assume that layout. |

Do not chase adapters/mcp-servers/scaffolds/prototypes discovery through the root script either - those category folders are missing on disk (reserved in governance only).

---

## Classic Toolforge (secondary)

Skills are the primary inventory. These classic areas still exist and have docs under `C:\dev\docs\...`, but they are **not** the same as the skills array in `manifest.json`.

### sync-tools

Still real: `multiRepoRoadmapSync` under `C:\dev\sync-tools\` (`.cjs` / `.ts`, plus `repo-registry.json`). Doc: [`docs\sync-tools\multiRepoRoadmapSync.md`](docs/sync-tools/multiRepoRoadmapSync.md).

Prefer calling the script directly (or via Task Scheduler helpers), not the broken root launcher:

```powershell
# Example shape - check the sync-tool README / ROADMAP-SYNC-SETUP for current args
node C:\dev\sync-tools\multiRepoRoadmapSync.cjs
```

### daemons (4)

Scripts under `C:\dev\daemons\`, docs under `C:\dev\docs\daemons\`:

| Doc | Script |
| --- | --- |
| [toolforgeManifestSync](docs/daemons/toolforgeManifestSync.md) | `toolforge-manifest-sync.ps1` |
| [toolforgeDocsSync](docs/daemons/toolforgeDocsSync.md) | `toolforge-docs-sync.ps1` |
| [toolforgeIndexSync](docs/daemons/toolforgeIndexSync.md) | `toolforge-index-sync.ps1` |
| [coworkAutoSync](docs/daemons/coworkAutoSync.md) | `cowork-auto-sync.ps1` |

```powershell
Get-ScheduledTask -TaskName "Toolforge*" -ErrorAction SilentlyContinue
# or run a daemon script directly from C:\dev\daemons for a one-off test
```

### utilities (~18 docs)

Setup and operator helpers under `C:\dev\utilities\`, documented in `C:\dev\docs\utilities\` (18 markdown pages). Useful ones:

- `run-tool.ps1` - skills list/select (this guide's primary launcher)
- `setup-task-scheduler.ps1` - classic scheduled tasks
- `skill-doc-validator.ps1` - README/SKILL.md compliance vs Skill Operator Guide
- skill health / install / drift / metadata helpers (`toolforgeSkill*.ps1`, etc.)

```powershell
& "C:\dev\utilities\setup-task-scheduler.ps1" -Install
& "C:\dev\utilities\skill-doc-validator.ps1" -Path skills -Recursive
```

### Reserved only (not on disk)

Governance still names these categories, but **folders are missing** under `C:\dev` and under `C:\dev\docs`:

- `adapters/`
- `mcp-servers/`
- `scaffolds/`
- `prototypes/`

Do not invent discovery flows for them. When they appear, update this guide and `docs\DOCS_INDEX.md`.

---

## Day-to-day operator flow

1. **Find a skill** - `utilities\run-tool.ps1 -ListOnly` or skim `manifest.json`.
2. **Read local docs** - `skills\<id>\README.md`, `SKILL.md`, and `docs\USAGE.md` if present; shared contract in `docs\meta\skill-operator-guide.md`.
3. **Run for real** - until the launcher executes runtimes, invoke the skill entrypoint from the manifest (`entrypoint` + `runtime`) yourself, or use the skill's documented CLI/test command.
4. **Classic jobs** - sync-tools / daemons / utilities via their scripts and `docs\` pages; Task Scheduler for recurring work.
5. **Navigate docs** - start at `docs\DOCS_INDEX.md`, not root `INDEX.md`.

---

## File locations (live)

| Item | Location |
| --- | --- |
| Workspace / Toolforge root | `C:\dev\` |
| Skills | `C:\dev\skills\<id>\` |
| Manifest (skills) | `C:\dev\manifest.json` |
| Skills launcher | `C:\dev\utilities\run-tool.ps1` |
| Docs hub | `C:\dev\docs\DOCS_INDEX.md` |
| Skill Operator Guide | `C:\dev\docs\meta\skill-operator-guide.md` |
| Classic sync-tools | `C:\dev\sync-tools\` |
| Classic daemons | `C:\dev\daemons\` |
| Classic utilities | `C:\dev\utilities\` |
| Governance | `C:\dev\GOVERNANCE.md` |
| Home overview | `C:\dev\Home.md` |
| Evidence-gate index (not a catalog) | `C:\dev\INDEX.md` |
| Missing / do not use as root | `C:\dev\toolforge\` |
| Legacy broken launcher | `C:\dev\run-tool.ps1` |

---

## Roles (short)

| Role | Focus |
| --- | --- |
| **Operator** | List skills, read USAGE, run entrypoints, watch daemons/tasks, troubleshoot |
| **Developer** | Author skills under `skills\`, keep README/SKILL/USAGE honest, pass doc validator |
| **Maintainer** | Keep `manifest.json`, governance, and docs indexes matched to disk |

---

## See also

- [`docs\DOCS_INDEX.md`](docs/DOCS_INDEX.md) - what is actually under `docs\`
- [`docs\meta\skill-operator-guide.md`](docs/meta/skill-operator-guide.md) - skill doc contract
- [`docs\utilities\runTool.md`](docs/utilities/runTool.md) - launcher behavior (including stubs)
- [`Home.md`](Home.md) - platform overview
- [`GOVERNANCE.md`](GOVERNANCE.md) - standards (includes reserved categories)
- Previous guide backup: `OPERATOR_GUIDE.md.bak`

---

*Rewritten 2026-09-07 against live inventory on this Windows machine. Skills-first; classic categories secondary; no phantom folders.*

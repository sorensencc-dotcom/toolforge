# Toolforge Documentation Index

Hand-written index of the first five Toolforge tool docs. Last edited 2026-10-06; checked against the repo the same day.

> **Not auto-generated.** The `toolforgeDocsSync` daemon that would regenerate this file is a one-line stub (`daemons/toolforge-docs-sync.ps1` prints a message and exits). This page does not list every tool.
>
> **Machine-readable catalog:** [manifest.json](https://github.com/sorensencc-dotcom/toolforge/blob/main/manifest.json) (v1.2.0, generated 2026-09-27) lists 54 skills. This is a different file from the one `run-tool.ps1` uses (`toolforge/manifest.json`). Human-readable list: [INDEX](INDEX). Use those, not this page, to find a tool.

---

## Sync-Tools

Multi-repository scanning, drift detection, and synchronization tools.

### multiRepoRoadmapSync

Unified drift detector + roadmap updater for sorensencc-dotcom repos.

- **Version**: 0.1.0
- **Status**: active
- **Schedule**: Daily 09:00 machine-local time (the task trigger carries no timezone), but only after the scheduled task is registered. The registrar `utilities/setup-task-scheduler.ps1` points at `C:\dev\tools\multiRepoRoadmapSync.cjs`, which does not exist; the script lives at `sync-tools/multiRepoRoadmapSync.cjs`. Fix that path before relying on the schedule.
- **Dependencies**: Node.js 20+, PowerShell 7+
- **Tool tags**: sync, automation, multi-repo

Quick start:
```powershell
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config repo-registry.json
```

---

## Daemons

Background services and long-running processes.

### toolforgeManifestSync

Background daemon that syncs toolforge manifest index.

- **Version**: 0.1.0
- **Status**: beta (stub). `daemons/toolforge-manifest-sync.ps1` only prints a message; no scheduled task is registered
- **Schedule**: none (design said every 15 minutes; nothing registers it)
- **Dependencies**: PowerShell 7+
- **Tool tags**: daemon, metadata

Automatically discovers new tools and updates manifest.json.

### toolforgeDocsSync

Background daemon that regenerates tool documentation.

- **Version**: 0.1.0
- **Status**: beta (stub). `daemons/toolforge-docs-sync.ps1` only prints a message; no scheduled task is registered
- **Dependencies**: PowerShell 7+
- **Tool tags**: daemon, documentation

Extracts tool metadata and generates markdown docs in `C:\dev\toolforge\docs\<category>\`.

### toolforgeIndexSync

Background daemon that updates tool index (INDEX.md).

- **Version**: 0.1.0
- **Status**: beta (stub). `daemons/toolforge-index-sync.ps1` only prints a message; no scheduled task is registered
- **Dependencies**: PowerShell 7+
- **Tool tags**: daemon, metadata

Generates human-readable tool index from manifest.json.

---

## Utilities

Setup, installation, and helper scripts.

### setupTaskScheduler

Windows Task Scheduler registration. Today the script registers one task, `Daily Roadmap Sync`.

- **Version**: 1.0.0
- **Status**: active (registers `Daily Roadmap Sync` only)
- **Dependencies**: PowerShell 7+, Administrator privileges
- **Tool tags**: setup, scheduling, windows

Quick start:
```powershell
& .\utilities\setup-task-scheduler.ps1 -SlackWebhook <url>
```

---

## Reserved Categories

The following categories are documented but currently have no active tools:

- **adapters/**: Data transformers (Phase 3)
- **mcp-servers/**: MCP server implementations (Phase 4)
- **scaffolds/**: Template generators (Phase 3)
- **prototypes/**: Experimental tools (on-demand)

---

## Documentation Structure

Each tool documentation file includes:

- **Purpose**: What the tool does
- **Inputs**: Configuration files, data sources
- **Outputs**: Generated files, logs, reports
- **Behavior**: Step-by-step operation flow
- **Dependencies**: Required software/privileges
- **Entrypoint**: Script file and runtime
- **Configuration**: Config file format (if applicable)
- **Schedule**: Execution frequency (if scheduled)
- **Error Handling**: Exit codes and failure modes
- **Examples**: Common usage patterns
- **Notes**: Important operational details
- **See Also**: Related tools and references

---

## Quick Reference

| Tool | Category | Type | Schedule |
|------|----------|------|----------|
| multiRepoRoadmapSync | sync-tools | Multi-repo scanner | Daily 09:00 local |
| toolforgeManifestSync | daemons | Beta (stub) | none |
| toolforgeDocsSync | daemons | Beta (stub) | none |
| toolforgeIndexSync | daemons | Beta (stub) | none |
| setupTaskScheduler | utilities | Setup tool | N/A (one-time) |

**Total**: 5 documented entries across 3 categories (2 working, 3 stubs, shown as `beta`). The full catalog is the repo-root `manifest.json`.

---

## How to Use These Docs

1. **Find a tool**: Look through categories above or use search
2. **Understand purpose**: Read "Purpose" section
3. **Configure**: See "Configuration" or "Inputs" section
4. **Run**: Check "Examples" for usage
5. **Debug**: Refer to "Error Handling" and "Notes"

---

## Tool Discovery

To see all available tools:

```powershell
.\run-tool.ps1 -Refresh   # scan first; -List alone reports "No tools or skills found"
# run-tool.ps1 reads and writes toolforge\manifest.json (next to the script), not the repo-root manifest.json
.\run-tool.ps1 -List
.\run-tool.ps1 -Inspect toolName
```

---

## Contributing New Tools

Docs are not generated automatically (`toolforgeDocsSync` is a beta stub). Write them by hand:

1. Create tool in correct category directory
2. Add metadata to manifest.json
3. Write the doc in `docs/<category>/<tool-name>.md` and add a row here

See [TOOL_CREATION_GUIDE](TOOL_CREATION_GUIDE) for details.

---

## See Also

- [Home](Home) — Toolforge overview
- [OPERATOR_GUIDE](OPERATOR_GUIDE) — How to run tools
- [GOVERNANCE](GOVERNANCE) — Tool standards
- [TOOL_CREATION_GUIDE](TOOL_CREATION_GUIDE) — Create new tools
- [manifest.json](https://github.com/sorensencc-dotcom/toolforge/blob/main/manifest.json) — Machine-readable tool registry
- [INDEX](INDEX) — Tool index (generated)

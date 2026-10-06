# toolforgeDocsSync

**Category**: daemons  
**Version**: 0.1.0  
**Status**: beta (stub; design only, 2026-10-06 review)  
**Owner**: soren  

## Current state (verified 2026-10-06)

[`daemons/toolforge-docs-sync.ps1`](../../daemons/toolforge-docs-sync.ps1) is a one-line stub. It prints `\Syncing DOCS_INDEX...\`, backslashes included, and does nothing else. `toolforge-install.ps1:157-167` wrote the stub with escaped quotes. The sections below describe the intended design, not shipped behavior. Nothing here is implemented:

- No scheduled task named `Toolforge-Docs-OnDemand` is registered by any script in this repo. [`utilities/setup-task-scheduler.ps1`](../../utilities/setup-task-scheduler.ps1) registers only `Daily Roadmap Sync`.
- `manifest.json` has no entry for this daemon.
- `daemons/README.md` does not exist. The See Also bullet below names the missing file in plain text.

## Purpose (intended)

Background daemon that regenerates tool documentation. Scans tool source files, extracts metadata, and generates markdown docs in `C:\dev\toolforge\docs\<category>\`.

## Tags

daemon, documentation

## Inputs

Reads from:
- All tool files: `*.ps1`, `*.cjs`, `*.ts`, `*.sh`, `*.js`
- File headers and comments
- manifest.json (for metadata)

## Outputs

- **Markdown docs**: `C:\dev\toolforge\docs\<category>\<tool-name>.md`
- **DOCS_INDEX.md**: Master index of all generated docs
- **Console**: Progress (files processed, docs generated)
- **Logs**: `C:\dev\logs\docs-sync-*.log`

## Behavior

1. Scan all category directories for tool files
2. For each tool, extract:
   - Name, category, version
   - Purpose (from file headers)
   - Inputs/outputs (from code inspection)
   - Parameters/configuration
   - Dependencies
   - Examples
3. Merge with manifest.json metadata
4. Generate markdown doc with template:
   - Overview section
   - Inputs/outputs
   - Configuration
   - Examples
   - Dependencies
   - Related tools
5. Create/update `DOCS_INDEX.md` with links to all docs
6. Report generation summary

## Dependencies

- PowerShell 7+

## Entrypoint

- **File**: `daemons/toolforge-docs-sync.ps1` (stub)
- **Runtime**: PowerShell 7+

## Schedule (intended)

- **Frequency**: Background daemon (on-demand via Task Scheduler or manual trigger)
- **Task Name**: `Toolforge-Docs-OnDemand`

## Error Handling (intended)

- Exit code 0: Success
- Exit code 1+: Failure (logs error details)
- Skips files with parse errors (logs warning)
- Preserves existing docs on error

## Generated Docs Structure

```
C:\dev\toolforge\docs\
├── DOCS_INDEX.md
├── sync-tools/
│   ├── multiRepoRoadmapSync.md
│   └── ...
├── daemons/
│   ├── toolforgeManifestSync.md
│   ├── toolforgeDocsSync.md
│   ├── toolforgeIndexSync.md
│   └── ...
├── utilities/
│   ├── setupTaskScheduler.md
│   └── ...
└── (other categories)
```

## Examples (intended)

```powershell
# Run manually
& "C:\dev\toolforge\daemons\toolforge-docs-sync.ps1"

# Trigger via Task Scheduler
Start-ScheduledTask -TaskName "Toolforge-Docs-OnDemand"

# View generated index
Get-Content C:\dev\toolforge\docs\DOCS_INDEX.md
```

## Notes

- Auto-triggered when tools are added/modified
- Supports multiple file types (PowerShell, Node.js, TypeScript, Bash)
- Generates consistent markdown format
- Preserves manual docs outside `docs/` directory

## See Also

- daemons/README.md — does not exist (dead link removed)
- [DOCS_INDEX.md](../../docs/DOCS_INDEX.md) — Generated index
- [TOOL_CREATION_GUIDE.md](../../TOOL_CREATION_GUIDE.md) — Tool creation (includes doc requirements)

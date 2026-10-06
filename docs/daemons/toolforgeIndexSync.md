# toolforgeIndexSync

**Category**: daemons  
**Version**: 0.1.0  
**Status**: beta (stub; design only, 2026-10-06 review)  
**Owner**: soren  

## Current state (verified 2026-10-06)

[`daemons/toolforge-index-sync.ps1`](../../daemons/toolforge-index-sync.ps1) is a one-line stub. It prints `\Syncing INDEX.md...\`, backslashes included, and does nothing else. `toolforge-install.ps1:157-167` wrote the stub with escaped quotes. The sections below describe the intended design, not shipped behavior. Nothing here is implemented:

- No scheduled task named `Toolforge-Index-OnDemand` is registered by any script in this repo. [`utilities/setup-task-scheduler.ps1`](../../utilities/setup-task-scheduler.ps1) registers only `Daily Roadmap Sync`.
- `manifest.json` has no entry for this daemon.
- `daemons/README.md` does not exist. The See Also bullet below names the missing file in plain text.

## Purpose (intended)

Background daemon that updates the tool index (INDEX.md). Reads manifest.json and generates a human-readable index of all available tools organized by category.

## Tags

daemon, metadata

## Inputs

- **manifest.json**: Tool registry with metadata
  - Each tool entry: name, category, version, description, status, schedule, lastRun

## Outputs

- **INDEX.md**: Human-readable tool index (markdown)
- **Console**: Progress (tools indexed, categories processed)
- **Logs**: `C:\dev\logs\index-sync-*.log`

## Behavior

1. Load manifest.json
2. Group tools by category: sync-tools, daemons, utilities, adapters, etc.
3. For each category, generate section with:
   - Tool name + version
   - Description
   - Entrypoint
   - Owner and tags
   - Dependencies
   - Schedule (if applicable)
   - Quick start command
4. Add reserved categories section (for future/unimplemented categories)
5. Add discovery commands section
6. Generate table of tool counts by category
7. Write INDEX.md
8. Log generation summary

## Dependencies

- PowerShell 7+

## Entrypoint

- **File**: `daemons/toolforge-index-sync.ps1` (stub)
- **Runtime**: PowerShell 7+

## Schedule (intended)

- **Frequency**: Background daemon (triggered after manifest changes)
- **Task Name**: `Toolforge-Index-OnDemand`

## Generated Index Format

```markdown
# Toolforge Index

Generated: 2026-06-28 16:35:00

## Sync-Tools
### toolName [version] — status
Description...
- Entrypoint: file.ps1
- Path: C:/dev/toolforge/category/toolname
- Owner: user
- Tags: tag1, tag2
- Schedule: Daily 10:00 AM
- Dependencies: Node.js 20+

## Daemons
...

## Total Tools
- Sync-Tools: N
- Daemons: N
- ...
**Total**: X active tools
```

## Error Handling (intended)

- Exit code 0: Success
- Exit code 1+: Failure (logs details)
- Skips malformed manifest entries
- Preserves previous INDEX.md if generation fails

## Examples (intended)

```powershell
# Run manually
& "C:\dev\toolforge\daemons\toolforge-index-sync.ps1"

# View generated index
Get-Content C:\dev\toolforge\INDEX.md

# Check tool summary
Select-String "^##" C:\dev\toolforge\INDEX.md
```

## Notes

- Auto-triggered when manifest.json changes
- Provides quick reference for operators
- Used by help/discovery commands
- Includes quick-start examples for common tools

## See Also

- daemons/README.md — does not exist (dead link removed)
- [INDEX.md](../../INDEX.md) — Generated index (human-readable)
- [manifest.json](../../manifest.json) — Source data (machine-readable)
- [run-tool.ps1](../../run-tool.ps1) — Tool runner (references INDEX)

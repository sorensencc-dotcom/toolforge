# Toolforge CLI

Existing PowerShell marketplace commands plus an input-aware read-only pilot CLI.

## Quick Start

```powershell
pwsh src/cli.ps1 -Command list -Category governance -Format json
pwsh src/cli.ps1 -Command install -Id my-plugin
pwsh src/cli.ps1 -Command submit -Path ./skills/my-plugin -DryRun
```

For the pilot, run Node 24 with one JSON object on UTF-8 stdin:

```powershell
$saved = $OutputEncoding
try {
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  '{"agentName":"example","expectedSchema":{},"actualSchema":{}}' | & 'C:/Program Files/nodejs/node.exe' 'C:/dev/toolforge/skills/toolforge-cli/src/invoke-skill.mjs' '--skill' 'agent-drift-detector' '--workspace-root' 'C:/dev/toolforge'
} finally { $OutputEncoding = $saved }
```

Use PowerShell 7+ for this example and generated clipboard commands. Adjust installed
paths before running. Windows PowerShell 5.1 cannot run copied pilot commands.
The existing `src/cli.ps1` interface remains separate.

Pilot IDs: `roadmap-validator`, `agent-drift-detector`, and `retro-schema-validator`.
One result envelope reaches stdout. Exit codes: 0 pass, 1 findings, 2 any other state.
No arbitrary module/export selection, downloads, saved inputs, or automatic retries.

Raw stdin caps at 65,536 UTF-8 bytes, including whitespace and caller-added newlines.
Generated commands write compact JSON to native stdin without a newline or BOM.
Selected files cap at 1 MiB each. Execution caps at five seconds, two active workers
per runner, and 128 KiB combined worker output. Reviewed-source drift or unsupported
runtime disables execution. Node permissions supplement source review.

See [Pilot usage and troubleshooting](docs/USAGE.md) for inputs, shared API,
clipboard formatting, and read-only boundary limits.

## What it does

- **list:** Browse registry with filters by category, status, version
- **install:** Deploy a plugin from the registry
- **submit:** Validate skill and submit for conformance review
- Delegates to registry-manager and submission-validator
- Supports dry-run preview and multiple output formats

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

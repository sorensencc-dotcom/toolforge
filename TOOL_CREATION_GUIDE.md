# Tool Creation Guide

Step-by-step guide for creating and registering new Toolforge capabilities.

**Workspace root**: `C:\dev` (there is no `C:\dev\toolforge` tree). Skills live under `C:\dev\skills\`; classic helpers still live under `sync-tools\`, `daemons\`, and `utilities\`.

## Before You Start

- Skim [GOVERNANCE.md](GOVERNANCE.md) for naming, versioning, and lifecycle rules
- Default to a **skill** unless you truly need a classic sync/daemon/utility
- Keep a clear, single-purpose use case
- Start versioning at `0.1.0` (beta until documented and tested)
- Read [docs/meta/skill-operator-guide.md](docs/meta/skill-operator-guide.md) before writing skill docs

## Step 1: Choose Category (honest inventory)

### Real categories (create here)

| If your capability... | Category | Path |
| --- | --- | --- |
| Reusable agent/automation unit with SKILL.md + README + usage docs | **skills** (primary) | `C:\dev\skills\<id>\` |
| Scans multiple repos, syncs state, detects drift | sync-tools | `C:\dev\sync-tools\` |
| Runs as a scheduled/background Windows task | daemons | `C:\dev\daemons\` |
| One-off setup or helper script | utilities | `C:\dev\utilities\` |

Most new work should be a skill under `skills\<id>`. Classic categories remain for the existing sync/daemon/utility scripts documented under `docs\`.

### Reserved / empty (do not create-here-now)

These names appear in older governance notes. On this machine the folders are **missing**, and they are **not** active create paths:

| Category | Status on disk |
| --- | --- |
| `adapters/` | Reserved / empty - not present under `C:\dev` |
| `mcp-servers/` | Reserved / empty - not present under `C:\dev` |
| `scaffolds/` | Reserved / empty - not present under `C:\dev` |
| `prototypes/` | Reserved / empty - not present under `C:\dev` |

Do not invent tools into phantom categories. If you need experimental work, put it under `skills\<id>` with `status: beta` (or keep it outside the registry until ready).

## Creating a Skill (preferred path)

### 1. Copy the template

```powershell
$id = "my-skill-id"   # kebab-case; becomes skills\<id>
Copy-Item -Recurse "C:\dev\skills\_TEMPLATE" "C:\dev\skills\$id"
cd "C:\dev\skills\$id"
```

Template layout (what authors edit):

```text
skills\<id>\
  SKILL.md          # metadata + execution spec (triggers, schemas, runtime)
  README.md         # short public face + quick start
  docs\USAGE.md     # deep workflow, examples, troubleshooting
  skill.json        # machine metadata (id, inputs/outputs, permissions)
  src\              # implementation (e.g. index.ts / run.sh)
  tests\            # unit + at least one integration test
```


Canonical doc roles: [docs/meta/skill-operator-guide.md](docs/meta/skill-operator-guide.md). Do not paste Setup/Requirements/Testing boilerplate into every README - link the operator guide instead.

### 2. Fill the required docs

- **README.md** - one-sentence pitch, quick start, 2-3 outcome bullets, then link the operator guide
- **SKILL.md** - frontmatter (`name`, `description`, `compatibility`), trigger text, input/output schemas
- **docs/USAGE.md** - multi-step workflows, integration patterns, troubleshooting only

Validate docs locally:

```powershell
& "C:\dev\utilities\skill-doc-validator.ps1" -Path "C:\dev\skills\$id"
```

### 3. Implement and test

Keep the entrypoint aligned with skill.json / manifest.
Run the skill test suite locally.

### 4. Register in manifest.json

Active skills are listed under the top-level skills array in C:\dev\manifest.json (51 active as of the Sep 2026 refresh).
Add an entry shaped like the live ones.
Do not invent a parallel tools-only registration for new skills.

Minimal shape (match neighbors in the file):

```json
{
  "id": "my-skill-id",
  "name": "my-skill-id",
  "version": "0.1.0",
  "description": "Clear one-line purpose.",
  "status": "active",
  "runtime": "node",
  "entrypoint": "src/index.ts",
  "owner": "soren",
  "category": "automation",
  "tags": [],
  "dependencies": {
    "external": [],
    "internal": []
  }
}
```

On-disk path is implied as C:\dev\skills\<id>.
See utilities/run-tool launcher which resolves skills under C:\dev\skills.

### 5. Discover / run

```powershell
cd C:\dev
& ".\utilities\run-tool.ps1" -ListOnly
# interactive select+run (skills-first launcher):
& ".\utilities\run-tool.ps1"
```

Root run-tool launcher may still exist for classic discovery; prefer utilities/run-tool for the skills registry.

## Creating a Classic Tool (sync-tools / daemons / utilities)

Only use this path when extending the classic script surface (not a skill).

### Directory

```powershell
$toolName = "myNewTool"
$category = "sync-tools"   # or daemons / utilities
$toolPath = "C:\dev\$category\$toolName"
New-Item -ItemType Directory -Path $toolPath -Force | Out-Null
```

### Core files

- README.md - purpose, usage, config, examples
- VERSION.md - semver + short changelog
- Entrypoint: run.ps1, runner.cjs, or language-appropriate script

### README stub

```markdown
# Tool Name

One-line purpose.

## Usage

```powershell
& "C:\dev\utilities\run-tool.ps1"
# or direct:
& "C:\dev\sync-tools\myNewTool\run.ps1" -Config config.json
```

## Configuration

Describe config file format and required fields.
```

### Best practices

1. Accept config as an argument
2. Validate config and dependencies on startup
3. Log progress with timestamps
4. Exit non-zero on failure with clear messages
5. Clean up handles / connections

### PowerShell sketch

```powershell
param([string]$ConfigPath = "config.json")

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ConfigPath)) {
  Write-Error "Config not found: $ConfigPath"
  exit 1
}

$config = Get-Content $ConfigPath | ConvertFrom-Json
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "[$timestamp] Starting..." -ForegroundColor Cyan

# work here

Write-Host "Done" -ForegroundColor Green
exit 0
```

### Node.js sketch

```javascript
const fs = require("fs");
const configPath = process.argv[2] || "config.json";

if (!fs.existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
console.log(`[${new Date().toISOString()}] Starting...`);
// work here
console.log("Done");
process.exit(0);
```

### Schedule (daemons / periodic sync-tools)

```powershell
& "C:\dev\utilities\setup-task-scheduler.ps1" -Install
# or register a dedicated task that calls your entrypoint under C:\dev\...
```

## Template Checklist

### Skills (primary)

- [ ] Copied from skills\_TEMPLATE into skills\<id>
- [ ] SKILL.md, README.md, and docs\USAGE.md filled (operator guide linked, not duplicated)
- [ ] skill.json id/name/version/entrypoint match the folder
- [ ] Implementation under src\ works locally
- [ ] Tests pass
- [ ] Entry added to manifest.json skills array
- [ ] Visible via utilities\run-tool.ps1 -ListOnly
- [ ] Doc validator clean (utilities\skill-doc-validator.ps1)

### Classic tools (secondary)

- [ ] Directory under sync-tools, daemons, or utilities only
- [ ] README + VERSION + working entrypoint
- [ ] Config validation + exit codes
- [ ] Documented under docs\<category>\ when you publish operator docs
- [ ] Not registered as if it lived under adapters/mcp-servers/scaffolds/prototypes

## See Also

- [GOVERNANCE.md](GOVERNANCE.md) - naming, versioning, lifecycle
- [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md) - how to run and inspect
- [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md) - honest map of docs on disk
- [docs/meta/skill-operator-guide.md](docs/meta/skill-operator-guide.md) - skill doc standard
- [skills/_TEMPLATE/](skills/_TEMPLATE/) - skill scaffold
- [skills/README.md](skills/README.md) - skills folder overview (may lag; trust disk + manifest)
- [manifest.json](manifest.json) - live skill registry

---

*Aligned to live C:\dev layout on 2026-09-07. Previous copy preserved as TOOL_CREATION_GUIDE.md.bak.*

# Toolforge Skill Validation Daemon

**Status**: Production-ready  
**Version**: 1.0.0  
**Location**: `C:\dev\toolforge\utilities\toolforgeSkillValidator.ps1`

---

## Purpose

Automated validation of all skills in `C:\dev\toolforge\skills/` against schema, structure, and integrity requirements.

Generates: `C:\dev\toolforge\skills\SKILLPACK-VALIDATION.md`

---

## What It Validates

### Schema (skill.json)
- ✓ All required fields present (id, name, version, category, description, metadata, inputs, outputs, permissions)
- ✓ Metadata complete (runtime, entrypoint, timeout)
- ✓ Version: semver format (X.Y.Z)
- ✓ ID: lowercase alphanumeric + hyphens only
- ✓ All input properties typed
- ✓ All output properties typed
- ✓ Permissions: required array non-empty

### Structure
- ✓ README.md exists
- ✓ INTEGRATION_DIAGRAM.md exists
- ✓ Entrypoint file exists (path from metadata.entrypoint)
- ✓ tests/ directory present
- ✓ tests/ directory non-empty (warning if empty)

### Integrity
- ✓ Skill IDs unique across entire skillpack
- ✓ Skill names unique (warning if duplicated)
- ✓ All discovered skills registered in manifest.json (info if missing)

---

## Usage

### Basic Run
```powershell
./toolforgeSkillValidator.ps1
```

### Verbose Mode
```powershell
./toolforgeSkillValidator.ps1 -Verbose
```

### Custom Output Path
```powershell
./toolforgeSkillValidator.ps1 -OutputPath "C:\reports\validation.md"
```

---

## Output

### Exit Code
- `0` — Validation passed (all errors must be 0)
- `1` — Validation failed (1+ errors found)

### Console Output
Shows real-time validation progress + summary:
```
🔍 Toolforge Skill Validator

  📦 Validating: roadmap-validator

✓ Report generated: C:\dev\toolforge\skills\SKILLPACK-VALIDATION.md

📊 Validation Summary
  ✅ Passed: 5
  ⚠️  Warnings: 0
  ❌ Errors: 0

✅ Validation PASSED
```

### Report File
Markdown report with:
- Summary table (passed/warnings/errors counts)
- Skills inventory table (ID, name, version, category, runtime)
- Detailed findings (errors, warnings, passes)
- Validation rules reference

---

## Integration Points

### Continuous Integration
Add to GitHub Actions or CI/CD pipeline:

```yaml
- name: Validate Skills
  run: |
    pwsh -Command "& 'C:\dev\toolforge\utilities\toolforgeSkillValidator.ps1'"
```

### Pre-Commit Hook
Validate before committing skill changes:

```powershell
# .git/hooks/pre-commit (PowerShell)
$result = & "C:\dev\toolforge\utilities\toolforgeSkillValidator.ps1"
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Skills validation failed" -ForegroundColor Red
  exit 1
}
```

### Automated Daemon
Run daily to monitor skillpack health:

```powershell
# Task Scheduler
$trigger = New-ScheduledTaskTrigger -Daily -At 06:00
$task = New-ScheduledTaskSettingsSet
Register-ScheduledTask -TaskName "Toolforge-SkillValidator" `
  -Action (New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-Command & 'C:\dev\toolforge\utilities\toolforgeSkillValidator.ps1'") `
  -Trigger $trigger `
  -Settings $task
```

---

## Validation Rules Reference

### Required Fields in skill.json
```json
{
  "id": "skill-id",
  "name": "Skill Name",
  "version": "1.0.0",
  "category": "category-name",
  "description": "...",
  "metadata": {
    "runtime": "typescript|node|powershell|...",
    "entrypoint": "src/index.ts",
    "timeout": 30000
  },
  "inputs": {
    "required": [...],
    "optional": [...]
  },
  "outputs": {
    "properties": {...}
  },
  "permissions": {
    "required": [...]
  }
}
```

### Required File Structure
```
skillpack/
├── skill.json              ✓ REQUIRED
├── README.md               ✓ REQUIRED
├── INTEGRATION_DIAGRAM.md  ✓ REQUIRED
├── src/
│   └── index.ts (or configured entrypoint)
├── tests/
│   └── *.test.ts           ✓ REQUIRED (non-empty)
└── docs/
    └── USAGE.md (optional)
```

---

## Common Issues & Fixes

### ❌ Missing required field
**Problem**: `Missing required field: metadata`
**Fix**: Add missing field to skill.json with correct structure

### ❌ Duplicate skill ID
**Problem**: `Duplicate skill ID: 'my-skill'`
**Fix**: Ensure each skill has unique ID (use skill directory name)

### ⚠️  No tests directory
**Problem**: `No tests/ directory found`
**Fix**: Create `tests/` directory with at least one test file

### ⚠️  Skill not in manifest
**Problem**: `Skill not registered in manifest: my-skill`
**Fix**: Run `./run-tool.ps1 -Refresh` to auto-discover and register

---

## Implementation Details

### Validation Flow
1. Scan `C:\dev\toolforge\skills/` for subdirectories
2. For each skill directory:
   - Parse skill.json
   - Validate schema completeness
   - Verify required files exist
3. Cross-skill checks:
   - Ensure ID uniqueness
   - Warn on name duplicates
   - Check manifest.json references
4. Generate markdown report
5. Exit with status code

### Error Levels
- **Error**: Blocks deployment, must be fixed
- **Warning**: Advisory, fix before deployment
- **Info**: Informational, no action required

---

## Development

### Adding New Validation Rules

1. Create function: `Validate-RuleName { ... }`
2. Call from appropriate phase (schema, files, cross-skill)
3. Return findings array: `@{ level = "error"|"warning"|"info"; msg = "..." }`
4. Update validation rules section in report

### Extending for New Runtimes

Update entrypoint validation in `Validate-SkillFiles` to support new file extensions:

```powershell
$runtimeMap = @{
  "typescript" = @("src/index.ts", "src/index.js")
  "python" = @("src/index.py")
  "golang" = @("src/main.go")
}
```

---

## Related Skills

- **roadmap-validator** — Validates ROADMAP.md sync markers
- **run-tool.ps1** — Discovers and executes tools/skills
- **toolforgeSkillSync.ps1** — Distributes skills to repos

---

## License

MIT

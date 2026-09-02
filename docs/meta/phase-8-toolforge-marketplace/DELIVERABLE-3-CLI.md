---
title: Deliverable 3 — CLI (list, install, submit)
phase: Phase 8 Wave D
owner: Tier 2 (Implementation)
status: READY FOR EXECUTION
---

# Deliverable 3 — CLI (list, install, submit)

## Objective
Implement three CLI commands: `toolforge list`, `toolforge install`, `toolforge submit`. Deterministic, non-interactive by default.

## Action

### 3.1 Create CLI Entry Point
**Output:** `skills/toolforge-cli/src/cli.ps1` (PowerShell)

Main function: `Invoke-ToolforgeCli -Command <string> -Args <string[]>`

Dispatch:
```powershell
switch ($Command) {
  "list" { Invoke-ToolforgeList @Args }
  "install" { Invoke-ToolforgeInstall @Args }
  "submit" { Invoke-ToolforgeSubmit @Args }
  default { Write-Error "Unknown command: $Command" }
}
```

### 3.2 `toolforge list` Command
**Behavior:**
- Read `docs/toolforge/registry.json`
- Filter by `--category` (optional) and `--status` (optional)
- Output as table (default) or JSON (`--format json`)
- Columns: ID | Name | Version | Category | Status | Published

**Signature:**
```powershell
Invoke-ToolforgeList [-Category <string>] [-Status <string>] [-Format <string>]
  # Output: table (stdout) | JSON (if --format json)
  # Exit code: 0 (success) | 1 (error)
  # Deterministic: same inputs → same output
```

**Example output:**
```
ID                           Name                         Version  Category    Status
--                           ----                         -------  --------    ------
toolforge-drift-monitor      Toolforge Drift Monitor      0.1.0    monitoring  published
tool-lifecycle-manager       Tool Lifecycle Manager       0.1.0    pipeline    published
```

### 3.3 `toolforge install` Command
**Behavior:**
1. Lookup plugin ID in registry
2. Verify plugin status = "published" (not quarantined)
3. Resolve manifest path from registry
4. Calculate checksum of skill directory
5. Verify checksum matches registry entry
6. Copy skill to `~/.toolforge/skills/<id>`
7. Update local install log
8. Print status + success/error

**Signature:**
```powershell
Invoke-ToolforgeInstall [-Id <string>] [-Version <string>] [-Force]
  # Params:
  #   -Id: plugin ID (required)
  #   -Version: semver constraint (optional, default latest)
  #   -Force: overwrite existing install (optional)
  # Output: progress lines + final status
  # Exit code: 0 (success) | 1 (error)
```

**Behavior on failure:**
- Download partially failed → delete local copy + error
- Checksum mismatch → error + don't install
- Plugin not found → error + suggest alternatives via `toolforge list`
- Plugin quarantined → error + explain why

### 3.4 `toolforge submit` Command
**Behavior:**
1. Validate skill path exists
2. Run manifest validator (Deliverable 4)
3. Generate submission ID
4. Create submission record in `.context/submissions/<id>.json`
5. Print conformance report (human + JSON)
6. Create PR with conformance check results
7. Print PR URL + next steps

**Signature:**
```powershell
Invoke-ToolforgeSubmit [-Path <string>] [-DryRun]
  # Params:
  #   -Path: skill directory (required)
  #   -DryRun: validate only, don't create submission (optional)
  # Output: submission ID + conformance report
  # Exit code: 0 (success) | 1 (error)
```

**Output (human-readable):**
```
Submission ID: sub-uuid-xxx
Skill: toolforge-drift-monitor (0.1.0)

Conformance Checks:
  ✓ manifest_valid
  ✓ tests_pass (coverage: 75%)
  ✓ docs_complete
  ✗ governance_aligned (blocker: Caveman review pending)
  ◐ caveman_review (pending)

Status: HOLD FOR CAVEMAN REVIEW

Next: https://github.com/soren/c--dev/pull/123 (Tier 1 review)
```

## Invariants
- **Determinism:** Same command + args → same output every time
- **No interactive prompts** (flags to enable if needed)
- **Idempotent:** `toolforge install` can be run multiple times safely
- **Non-destructive:** Failures don't corrupt registry or local state
- **Checksum verification:** All installs verified before use

## Success Criteria
- ✓ CLI entry point created + functions dispatch correctly
- ✓ `toolforge list` returns all published plugins (table format)
- ✓ `toolforge list --format json` returns valid JSON
- ✓ `toolforge install <id>` downloads + verifies + installs
- ✓ `toolforge install` fails gracefully on error (no partial install)
- ✓ `toolforge submit <path>` generates submission + calls validator
- ✓ All commands deterministic (same inputs → same output)
- ✓ All commands have help text (`--help`)

## Test Strategy
```powershell
# Test 1: List all plugins
Invoke-ToolforgeList
# Expected: table with toolforge-drift-monitor + tool-lifecycle-manager

# Test 2: List by category
Invoke-ToolforgeList -Category monitoring
# Expected: table with only monitoring-category plugins

# Test 3: List as JSON
Invoke-ToolforgeList -Format json | ConvertFrom-Json
# Expected: valid JSON, plugins array present

# Test 4: Install missing plugin fails
Invoke-ToolforgeInstall -Id "nonexistent"
# Expected: error message, exit code 1

# Test 5: Install valid plugin
Invoke-ToolforgeInstall -Id "toolforge-drift-monitor"
# Expected: ✓ status, exit code 0, file exists in ~/.toolforge/skills/

# Test 6: Submit skill with dry-run
Invoke-ToolforgeSubmit -Path ./skills/toolforge-drift-monitor -DryRun
# Expected: conformance report printed, no PR created

# Test 7: Submit real skill
Invoke-ToolforgeSubmit -Path ./skills/toolforge-drift-monitor
# Expected: submission ID created, PR opened, exit code 0
```

## Exit Criteria (Binary)
- [ ] CLI entry point exists + is executable
- [ ] `toolforge list` command works + returns all published plugins
- [ ] `toolforge list --category <cat>` filters correctly
- [ ] `toolforge list --format json` returns valid JSON
- [ ] `toolforge install <id>` downloads + installs correctly
- [ ] `toolforge install` fails gracefully (checksum mismatch, etc)
- [ ] `toolforge submit <path>` calls validator + creates submission
- [ ] All commands deterministic + idempotent
- [ ] All commands have `--help` text
- [ ] Documentation added to `docs/toolforge/CLI.md`

---

## Related
- Deliverable 1: Manifest Schema (cli validates manifests)
- Deliverable 2: Registry Service (cli reads/writes registry)
- Deliverable 4: Validator (cli calls validator for submit)

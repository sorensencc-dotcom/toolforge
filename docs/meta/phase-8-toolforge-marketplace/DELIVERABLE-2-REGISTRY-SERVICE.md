---
title: Deliverable 2 — Registry Service
phase: Phase 8 Wave D
owner: Tier 2 (Implementation)
status: READY FOR EXECUTION
---

# Deliverable 2 — Registry Service

## Objective
Implement append-only registry at `docs/toolforge/registry.json`. Single source of truth. Tool-based mutations only (no manual edits).

## Action

### 2.1 Create Registry Infrastructure

**Output:** `docs/toolforge/registry.json` (canonical file, version controlled)

Initial state (empty):
```json
{
  "registry_version": "1.0",
  "generated": "2026-07-13T00:00:00Z",
  "plugins": [],
  "metadata": {
    "total_plugins": 0,
    "published_count": 0,
    "pending_count": 0,
    "deprecated_count": 0
  }
}
```

### 2.2 Create Registry Tool
**Output:** `skills/toolforge-registry-manager/src/registry.ps1` (PowerShell)

Functions:
```powershell
Add-PluginToRegistry -PluginId <string> -Path <string> -Checksum <string>
  # Add entry to registry
  # Input: plugin ID, manifest path, SHA256 checksum
  # Output: updated registry.json
  # Behavior: append-only (fail if ID already exists)

Get-PluginFromRegistry -PluginId <string>
  # Query single plugin
  # Output: plugin object or null

List-PublishedPlugins [-Category <string>]
  # Query all published plugins
  # Output: array of plugin objects

Mark-PluginQuarantined -PluginId <string> -Reason <string>
  # Mark entry as quarantined (safety issue)
  # Output: updated registry.json + audit log entry

Update-RegistryMetadata
  # Recount published/pending/deprecated
  # Output: updated metadata
```

### 2.3 Checksum Generation
**Output:** `skills/toolforge-registry-manager/src/checksum.ps1`

Function: `Get-PluginChecksum -Path <string> -Algorithm <string>`
- Default algorithm: SHA256
- Includes all files in plugin directory (skip .git, node_modules, .env)
- Deterministic (same files → same checksum)
- Output format: `sha256-<hex>`

### 2.4 Registry Audit Log
**Output:** `docs/toolforge/registry-audit.log` (append-only text log)

Format: `TIMESTAMP | OPERATION | PLUGIN_ID | STATUS | DETAILS`

Example:
```
2026-07-13T12:00:00Z | ADD | toolforge-drift-monitor | SUCCESS | entry added
2026-07-13T12:05:00Z | QUARANTINE | toolforge-drift-monitor | SUCCESS | safety review failed
```

## Invariants
- **Append-only:** Registry.json never rewrites existing entries, only appends
- **No manual edits:** Changes only via registry tool
- **Checksum immutable:** Once published, entry checksum never changes
- **Audit trail:** All mutations logged to audit log
- **Atomic writes:** Registry updates are atomic (git commit + push)

## Success Criteria
- ✓ Registry file created at `docs/toolforge/registry.json`
- ✓ Registry tool created + all functions work
- ✓ Checksum generator deterministic + matches git hash
- ✓ Audit log created + populated with test entries
- ✓ `Add-PluginToRegistry` fails if plugin ID already exists
- ✓ `Mark-PluginQuarantined` updates status without rewriting entry
- ✓ Registry metadata counts accurate
- ✓ All mutations tracked in git history

## Test Strategy
```powershell
# Test 1: Add entry
Add-PluginToRegistry -PluginId "test-skill" -Path "skills/test-skill" -Checksum "sha256-abc123"
# Expected: registry.json contains new entry, git shows change

# Test 2: Duplicate ID fails
Add-PluginToRegistry -PluginId "test-skill" -Path "..." -Checksum "sha256-xyz"
# Expected: Error "Plugin already exists"

# Test 3: Checksum deterministic
Get-PluginChecksum -Path "skills/test-skill"
Get-PluginChecksum -Path "skills/test-skill"
# Expected: same checksum both calls

# Test 4: Quarantine doesn't rewrite entry
Mark-PluginQuarantined -PluginId "test-skill" -Reason "safety issue"
$entry = Get-PluginFromRegistry -PluginId "test-skill"
# Expected: $entry.status = "quarantined", all other fields unchanged

# Test 5: Audit log populated
Get-Content registry-audit.log | Measure-Object -Line
# Expected: line count > 0, format correct
```

## Exit Criteria (Binary)
- [ ] Registry file exists at `docs/toolforge/registry.json`
- [ ] Registry tool functions exist + execute without error
- [ ] Checksum function deterministic (same input → same output)
- [ ] Audit log created + formatted correctly
- [ ] `Add-PluginToRegistry` enforces append-only semantics (no duplicates)
- [ ] All registry mutations tracked in git history
- [ ] Documentation added to `docs/toolforge/REGISTRY.md`

---

## Related
- Deliverable 1: Manifest Schema (registry validates entries against schema)
- Deliverable 3: CLI (toolforge install/list consumes registry)
- Deliverable 4: Validator (submission validator updates registry)

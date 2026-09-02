---
title: Deliverable 1 — Plugin Manifest Schema
phase: Phase 8 Wave D
owner: Tier 2 (Implementation)
status: READY FOR EXECUTION
---

# Deliverable 1 — Plugin Manifest Schema

## Objective
Define JSON schema for plugin manifest that extends SKILL.json with marketplace-specific fields (`_marketplace`). Backward compatible. Enforced by validator + CLI.

## Action

### 1.1 Create Schema Definition
**Output:** `docs/toolforge/schemas/skill.marketplace.schema.json`

Schema must define:
- Full SKILL.json structure (existing fields)
- `_marketplace` object (new fields)
- All field types, required fields, allowed values
- Version field: `_marketplace.registry_entry = "toolforge-marketplace:1.0"`

**Schema structure (JSONSchema Draft 7):**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Toolforge Plugin Manifest",
  "type": "object",
  "required": ["id", "name", "version", "description", "status", "category", "runtime", "entrypoint", "owner"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "name": { "type": "string" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "description": { "type": "string" },
    "status": { "enum": ["active", "deprecated", "inactive"] },
    "category": { "enum": ["monitoring", "pipeline", "utility", "integration", "governance"] },
    "runtime": { "enum": ["typescript", "powershell", "bash", "node"] },
    "entrypoint": { "type": "string" },
    "owner": { "type": "string" },
    "permissions": {
      "type": "object",
      "properties": {
        "required": { "type": "array", "items": { "type": "string" } },
        "optional": { "type": "array", "items": { "type": "string" } }
      }
    },
    "dependencies": {
      "type": "object",
      "properties": {
        "external": { "type": "array" },
        "internal": { "type": "array" }
      }
    },
    "_marketplace": {
      "type": "object",
      "required": ["registry_entry"],
      "properties": {
        "registry_entry": { "const": "toolforge-marketplace:1.0" },
        "submission_status": { "enum": ["pending", "approved", "published", "rejected", "deprecated"] },
        "published_date": { "type": ["string", "null"], "format": "date-time" },
        "installed_count": { "type": "integer", "minimum": 0 },
        "marketplace_visibility": { "enum": ["public", "private", "deprecated"] },
        "submission_id": { "type": ["string", "null"], "pattern": "^sub-[a-f0-9-]+$|^null$" },
        "conformance_check": {
          "type": "object",
          "properties": {
            "passed": { "type": "boolean" },
            "timestamp": { "type": "string", "format": "date-time" },
            "checks": {
              "type": "object",
              "properties": {
                "manifest_valid": { "type": "boolean" },
                "tests_pass": { "type": "boolean" },
                "docs_complete": { "type": "boolean" },
                "governance_aligned": { "type": "boolean" },
                "caveman_review": { "enum": ["pending", "pass", "fail"] }
              }
            },
            "blockers": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    }
  }
}
```

### 1.2 Create Manifest Validator
**Output:** `docs/toolforge/validators/manifest-validator.ps1` (PowerShell)

Function: `Validate-PluginManifest -Path <skill-dir> -Schema <schema-path>`

**Behavior:**
- Load SKILL.json from `<skill-dir>/SKILL.json`
- Validate against schema (all fields present, types correct, enum values valid)
- Output: `[PSCustomObject]@{ Valid=$true/false; Errors=[string[]] }`
- Exit code: 0 (valid) | 1 (invalid)

### 1.3 Update Existing Skills
**Action:** Add `_marketplace` fields to existing SKILL.json files:
- `skills/toolforge-drift-monitor/SKILL.json`
- `skills/tool-lifecycle-manager/SKILL.json`

**Template:**
```json
{
  "_marketplace": {
    "registry_entry": "toolforge-marketplace:1.0",
    "submission_status": "pending",
    "published_date": null,
    "installed_count": 0,
    "marketplace_visibility": "private",
    "submission_id": null,
    "conformance_check": {
      "passed": false,
      "timestamp": "2026-07-13T00:00:00Z",
      "checks": {
        "manifest_valid": true,
        "tests_pass": null,
        "docs_complete": null,
        "governance_aligned": null,
        "caveman_review": "pending"
      },
      "blockers": []
    }
  },
  ... rest of SKILL.json fields ...
}
```

## Invariants
- **No breaking changes** to existing SKILL.json structure (new fields only)
- **Schema versioning** via `_marketplace.registry_entry` (enables future v1.1, v2.0)
- **All SKILL.json fields remain optional** except those already required
- **Validator is deterministic** (same manifest → same output)

## Success Criteria
- ✓ Schema file created at `docs/toolforge/schemas/skill.marketplace.schema.json`
- ✓ Schema validates against JSONSchema Draft 7
- ✓ Manifest validator created + executable
- ✓ Existing 2 skills updated + validate against schema
- ✓ `npm run test:manifest-schema` passes all tests
- ✓ Zero breaking changes to existing skill tooling

## Test Strategy
```powershell
# Test 1: Valid manifest passes
Validate-PluginManifest -Path skills/toolforge-drift-monitor -Schema schema.json
# Expected: Valid=$true, Errors=@()

# Test 2: Missing required field fails
$broken = $manifest | ConvertTo-Json | % { $_ -replace '"name":.*', '"name": null' }
# Expected: Valid=$false, Errors containing "name is required"

# Test 3: Invalid enum value fails
$broken._marketplace.submission_status = "invalid"
# Expected: Valid=$false, Errors containing "invalid enum value"

# Test 4: Schema itself validates
Get-Content schema.json | ConvertFrom-Json | % { $_.`$schema }
# Expected: "http://json-schema.org/draft-07/schema#"
```

## Exit Criteria (Binary)
- [ ] Schema file exists + is valid JSONSchema
- [ ] Manifest validator PowerShell script exists + runs without error
- [ ] toolforge-drift-monitor SKILL.json has `_marketplace` + validates
- [ ] tool-lifecycle-manager SKILL.json has `_marketplace` + validates
- [ ] All schema tests passing
- [ ] Documentation added to `docs/toolforge/SCHEMA.md`

---

## Related
- Deliverable 2: Registry Service (uses this schema to validate entries)
- Deliverable 4: Validator (enforces this schema at submission time)

# Retro Schema Validator — Usage Guide

## Canonical Schema v1.0

```json
{
  "date": "YYYY-MM-DD",
  "type": "retro|standup|digest",
  "metrics": {
    "unit_scale": 0-100,
    "active_days": 0-7,
    "commits_authored": number,
    "issues_closed": number
  },
  "sections": {
    "wins": string[],
    "blockers": string[],
    "next": string[]
  },
  "notes": string
}
```

## Examples

### Validate Single Retro

```bash
/skill retro-schema-validator .retro/2026-08-23-1.json
# Output:
# ✓ Schema Compliance: All required fields present
# ✓ Type Validation: All fields match schema types
# ✓ Range Checks: unit_scale=85 (valid), active_days=5 (valid)
# GREEN — Retro complies with v1.0 schema
```

### Validate All Retros

```bash
/skill retro-schema-validator --all
# Validates all .retro/*.json files
# Reports any schema drift across files
```

### Verbose Output

```bash
/skill retro-schema-validator --all --verbose
# Shows field-by-field validation for each file
```

## Common Issues & Fixes

**Type Mismatch:**
```
❌ Type Validation: Field "unit_scale" is string "85" but should be number
```
**Fix:** Convert to number in JSON:
```json
// Before (wrong)
"unit_scale": "85"

// After (correct)
"unit_scale": 85
```

**Range Error:**
```
❌ Range Checks: Field "active_days" is 10 but must be 0-7
```
**Fix:** Correct the value:
```json
"active_days": 6  // valid (0-7)
```

**Missing Required Field:**
```
❌ Schema Compliance: Missing required field "metrics.unit_scale"
```
**Fix:** Add the field to your retro JSON.

**Extra Field (Not in Schema):**
```
⚠️  Field Consistency: Unknown field "custom_metric" (not in v1.0 schema)
```
**Fix:** Remove unknown fields or request schema update.

## Incident History

**Early Retro Schema Bugs (2026-07-12):**
- Earliest retro file (2026-07-12-1.json) had unit-scale and active_days bugs
- Bugs caught retroactively (2026-08-16), schema locked to v1.0
- This skill prevents similar bugs in new retros by validating at write-time

## Integration

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:
```bash
/skill retro-schema-validator --all || exit 1
```

### CI Pipeline

In `.github/workflows/validation.yml`:
```yaml
- name: Validate retro schema
  run: /skill retro-schema-validator --all
```

### Local Validation Before Push

```bash
npm run retro:validate  # add to package.json
```

## Reference

Canonical schema: See `MEMORY.md` "Retro Schema Canonical v1.0 Lock".

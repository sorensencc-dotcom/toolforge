# Retro Schema Validator

Validate `.retro/*.json` files against canonical schema v1.0. Catches schema drift, type mismatches, and missing fields before commit.

## Quick Start

```bash
/skill retro-schema-validator
```

## What It Checks

- **Schema Compliance**: All required fields present (date, type, metrics, etc.)
- **Type Validation**: numeric fields are numbers, arrays are arrays, dates are ISO 8601
- **Range Checks**: Metrics within expected ranges (unit-scale 0–100, active_days 0–7, etc.)
- **Field Consistency**: No new fields outside v1.0 schema
- **Canonical Format**: Field names match v1.0 naming conventions

## Workflow

Run before committing new retro files to catch schema bugs early:

```bash
/skill retro-schema-validator [path]  # validate single file
/skill retro-schema-validator --all   # validate all .retro/*.json
```

Output: RED (schema violations) | YELLOW (warnings) | GREEN (compliant)

## Reference

See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for full details.  
For examples and canonical schema: [docs/USAGE.md](docs/USAGE.md).

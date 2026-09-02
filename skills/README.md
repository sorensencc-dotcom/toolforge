# Toolforge Skills

Reusable, composable automation units for Toolforge platform.

**Status**: Framework ready (no skills yet)  
**Location**: `C:\dev\toolforge\skills\`  
**Validation**: [SKILLPACK-VALIDATION.md](SKILLPACK-VALIDATION.md)

---

## Quick Start

Create skill from template:

```bash
cp -r _TEMPLATE my-skill
cd my-skill
# Edit skill.json, src/index.ts, tests/, docs/
```

---

## Structure

```
skills/
├── _TEMPLATE/           # Skill scaffold
├── skill-name-1/        # Individual skill 1
├── skill-name-2/        # Individual skill 2
└── README.md            # This file
```

---

## Skill Requirements

Each skill **must** have:

1. **skill.json** — Metadata (id, name, version, inputs, outputs, permissions)
2. **src/** — Implementation (entrypoint file)
3. **tests/** — Test suite
4. **docs/** — Usage documentation
5. **README.md** — Quick reference

See [SKILLPACK-VALIDATION.md](SKILLPACK-VALIDATION.md) for full schema.

---

## Integration

Skills integrate with:

- **Toolforge**: Registered in `manifest.json`
- **Distributed**: Synced to `rewrite-mcp/toolforge/skills/`
- **CIC**: Optional adapters for CIC ingestion
- **Documentation**: Docs in `docs/skills/`

---

## Discovery

List available skills:

```powershell
.\run-tool.ps1 -List -Category skills
.\run-tool.ps1 -Inspect skill-name
```

---

## Validation

Validate skillpack:

```powershell
# Check single skill
Test-Json -Path "skill-name/skill.json"

# Verify in manifest
Select-String "skill-name" manifest.json

# Full validation (when available)
.\toolforgeSkillValidator.ps1
```

---

## See Also

- [SKILLPACK-VALIDATION.md](SKILLPACK-VALIDATION.md) — Full validation framework
- [_TEMPLATE/](\_TEMPLATE/) — Reference scaffold
- [../manifest.json](../manifest.json) — Skill registry
- [../docs/skills/](../docs/skills/) — Skill documentation

---

# Toolforge Skill Validation Report

**Generated**: 2026-06-29T15:54:55.6209408Z

---

## Executive Summary

| Domain | Errors | Warnings | Passed | Status |
|--------|--------|----------|--------|--------|
| Canonical | 0 | 0 | 0 | ✅ |
| Distributed | 0 | 1 | 0 | ✅ |
| Manifest | 0 | 1 | 0 | ✅ |
| Cowork | 0 | 3 | 0 | ✅ |
| Dependencies | 0 | 0 | 1 | ✅ |
| Runtime | 0 | 0 | 3 | ✅ |
| Audit | 0 | 0 | 1 | ℹ️ |

**Total Errors**: 0
**Total Warnings**: 5

**Overall Status**: ✅ PASS

---

## Skills Inventory

| ID | Name | Version | Status | Canonical | Distributed | Manifest | Cowork | Runtime |
|----|------|---------|--------|-----------|-------------|----------|--------|---------|
| roadmap-validator | Roadmap Validator | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| tool-lifecycle-manager | Tool Lifecycle Manager | 0.1.0 | active | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| toolforge-drift-monitor | Toolforge Drift Monitor | 0.1.0 | active | ✅ | ✅ | ✅ | ⚠️ | ✅ |

---

## Distributed Validation

⚠️ **roadmap-validator**: Directory missing in distributed

## Manifest Validation

⚠️ **roadmap-validator**: Tags mismatch: canonical '', manifest 'validation, roadmap'

## Cowork Validation

⚠️ **roadmap-validator**: Not registered (installer will register on next run)
⚠️ **tool-lifecycle-manager**: Not registered (installer will register on next run)
⚠️ **toolforge-drift-monitor**: Not registered (installer will register on next run)

## Runtime Validation

ℹ️ **roadmap-validator**: Skill inactive (status: )
ℹ️ **tool-lifecycle-manager**: Discoverable
ℹ️ **toolforge-drift-monitor**: Discoverable

## Audit Validation

ℹ️ **system**: No runtime log yet (skills not executed)

---

## Validator Rules Reference

### Canonical Skills
- SKILL.json exists and is valid
- Required files: SKILL.md, README.md, INTEGRATION_DIAGRAM.md
- Entrypoint exists and is valid
- Schema: id, name, version (semver), runtime, category
- ID format: lowercase alphanumeric + hyphens
- No duplicate IDs or names

### Distributed Sync
- Skill directory exists in distributed
- SKILL.json exists and versions match
- Entrypoint file exists
- No missing artifacts

### Manifest Consistency
- Version >= 1.1.0
- Skills array present
- Each skill has manifest entry
- Paths match: skills/<id>
- Versions match canonical
- No duplicate entries

### Cowork Registration
- Skill appears in COWORK-REGISTERED-SKILLS.md
- Warning if missing (installer will register next run)

### Dependency Graph
- Internal dependencies exist in canonical skills
- External dependencies exist in tools/daemons/adapters
- Canonical vs manifest dependencies must match (error if mismatch)
- Canonical vs distributed dependencies (warning if mismatch)
- No cycles detected (error if found)
- Dependency depth computed for orchestration
- Orphans and missing dependencies flagged

### Runtime Discovery
- Skill status = active
- Entrypoint file exists
- Runtime is valid (typescript|javascript|python|powershell|bash)
- Skill is discoverable and executable

### Audit Logs
- SKILL-RUN-LOG.md exists
- Logged skill IDs match canonical skills
- No unknown skills in logs

---

## Next Steps

1. **Fix errors first**: Canonical + manifest errors must be resolved
2. **Distributed sync**: Installer will sync missing skills
3. **Cowork registration**: Installer will register on next run
4. **Runtime validation**: Check discovery logs if skills don't appear
5. **Audit logs**: Monitor SKILL-RUN-LOG.md for execution patterns

---

**Skill Validator v1.1.0** | Toolforge Team

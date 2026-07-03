# Toolforge Skill Validation Report

**Generated**: 2026-07-03T14:18:20.5055635Z

---

## Executive Summary

| Domain | Errors | Warnings | Passed | Status |
|--------|--------|----------|--------|--------|
| Canonical | 28 | 7 | 0 | ❌ |
| Distributed | 0 | 8 | 0 | ✅ |
| Manifest | 0 | 1 | 0 | ✅ |
| Cowork | 0 | 10 | 0 | ✅ |
| Dependencies | 0 | 0 | 1 | ✅ |
| Runtime | 0 | 0 | 10 | ✅ |
| Audit | 0 | 0 | 1 | ℹ️ |

**Total Errors**: 28
**Total Warnings**: 26

**Overall Status**: ❌ FAIL

---

## Skills Inventory

| ID | Name | Version | Status | Canonical | Distributed | Manifest | Cowork | Runtime |
|----|------|---------|--------|-----------|-------------|----------|--------|---------|
| analyze-token-burn | analyze-token-burn | 1.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| kb-sync-nightly | kb-sync-nightly | 1.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| reconcile-vector-store | reconcile-vector-store | 1.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| roadmap-validator | Roadmap Validator | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| rollback-phase | rollback-phase | 1.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| run-adapter-diagnostic | run-adapter-diagnostic | 1.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| scale-ingestion-service | scale-ingestion-service | 1.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| tool-lifecycle-manager | Tool Lifecycle Manager | 0.1.0 | active | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| toolforge-drift-monitor | Toolforge Drift Monitor | 0.1.0 | active | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| work-summarizer | Work Summarizer v4.0 | 4.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |

---

## Canonical Validation

❌ **analyze-token-burn**: Missing: SKILL.md
❌ **analyze-token-burn**: Missing: INTEGRATION_DIAGRAM.md
❌ **analyze-token-burn**: Entrypoint not specified
❌ **analyze-token-burn**: Missing: runtime
⚠️ **analyze-token-burn**: Category missing (using fallback: utility)
⚠️ **kb-sync-nightly**: Invalid category: documentation
❌ **kb-sync-nightly**: Entrypoint not specified
❌ **kb-sync-nightly**: Missing: runtime
❌ **kb-sync-nightly**: Missing: SKILL.md
❌ **kb-sync-nightly**: Missing: INTEGRATION_DIAGRAM.md
❌ **reconcile-vector-store**: Missing: SKILL.md
❌ **reconcile-vector-store**: Missing: INTEGRATION_DIAGRAM.md
❌ **reconcile-vector-store**: Entrypoint not specified
❌ **reconcile-vector-store**: Missing: runtime
⚠️ **reconcile-vector-store**: Category missing (using fallback: utility)
⚠️ **rollback-phase**: Category missing (using fallback: utility)
❌ **rollback-phase**: Missing: runtime
❌ **rollback-phase**: Entrypoint not specified
❌ **rollback-phase**: Missing: INTEGRATION_DIAGRAM.md
❌ **rollback-phase**: Missing: SKILL.md
❌ **run-adapter-diagnostic**: Missing: SKILL.md
❌ **run-adapter-diagnostic**: Missing: INTEGRATION_DIAGRAM.md
❌ **run-adapter-diagnostic**: Entrypoint not specified
❌ **run-adapter-diagnostic**: Missing: runtime
⚠️ **run-adapter-diagnostic**: Category missing (using fallback: utility)
⚠️ **scale-ingestion-service**: Category missing (using fallback: utility)
❌ **scale-ingestion-service**: Missing: runtime
❌ **scale-ingestion-service**: Missing: INTEGRATION_DIAGRAM.md
❌ **scale-ingestion-service**: Missing: SKILL.md
❌ **scale-ingestion-service**: Entrypoint not specified
❌ **work-summarizer**: Missing: runtime
❌ **work-summarizer**: Missing: SKILL.md
❌ **work-summarizer**: Missing: INTEGRATION_DIAGRAM.md
❌ **work-summarizer**: Entrypoint not specified
⚠️ **work-summarizer**: Invalid category: development-observability

## Distributed Validation

⚠️ **analyze-token-burn**: Directory missing in distributed
⚠️ **kb-sync-nightly**: Directory missing in distributed
⚠️ **reconcile-vector-store**: Directory missing in distributed
⚠️ **roadmap-validator**: Directory missing in distributed
⚠️ **rollback-phase**: Directory missing in distributed
⚠️ **run-adapter-diagnostic**: Directory missing in distributed
⚠️ **scale-ingestion-service**: Directory missing in distributed
⚠️ **work-summarizer**: Directory missing in distributed

## Manifest Validation

⚠️ **roadmap-validator**: Tags mismatch: canonical '', manifest 'validation, roadmap'

## Cowork Validation

⚠️ **analyze-token-burn**: Not registered (installer will register on next run)
⚠️ **kb-sync-nightly**: Not registered (installer will register on next run)
⚠️ **reconcile-vector-store**: Not registered (installer will register on next run)
⚠️ **roadmap-validator**: Not registered (installer will register on next run)
⚠️ **rollback-phase**: Not registered (installer will register on next run)
⚠️ **run-adapter-diagnostic**: Not registered (installer will register on next run)
⚠️ **scale-ingestion-service**: Not registered (installer will register on next run)
⚠️ **tool-lifecycle-manager**: Not registered (installer will register on next run)
⚠️ **toolforge-drift-monitor**: Not registered (installer will register on next run)
⚠️ **work-summarizer**: Not registered (installer will register on next run)

## Runtime Validation

ℹ️ **analyze-token-burn**: Skill inactive (status: )
ℹ️ **kb-sync-nightly**: Skill inactive (status: )
ℹ️ **reconcile-vector-store**: Skill inactive (status: )
ℹ️ **roadmap-validator**: Skill inactive (status: )
ℹ️ **rollback-phase**: Skill inactive (status: )
ℹ️ **run-adapter-diagnostic**: Skill inactive (status: )
ℹ️ **scale-ingestion-service**: Skill inactive (status: )
ℹ️ **tool-lifecycle-manager**: Discoverable
ℹ️ **toolforge-drift-monitor**: Discoverable
ℹ️ **work-summarizer**: Skill inactive (status: )

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

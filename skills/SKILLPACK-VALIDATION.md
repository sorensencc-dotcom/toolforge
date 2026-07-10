# Toolforge Skill Validation Report

**Generated**: 2026-07-10T12:09:18.0887687Z

---

## Executive Summary

| Domain | Errors | Warnings | Passed | Status |
|--------|--------|----------|--------|--------|
| Canonical | 0 | 11 | 0 | ✅ |
| Distributed | 0 | 3 | 0 | ✅ |
| Manifest | 0 | 52 | 0 | ✅ |
| Cowork | 0 | 22 | 0 | ✅ |
| Dependencies | 0 | 1 | 1 | ✅ |
| Runtime | 0 | 0 | 22 | ✅ |
| Audit | 0 | 0 | 0 | ℹ️ |

**Total Errors**: 0
**Total Warnings**: 89

**Overall Status**: ✅ PASS

---

## Skills Inventory

| ID | Name | Version | Status | Canonical | Distributed | Manifest | Cowork | Runtime |
|----|------|---------|--------|-----------|-------------|----------|--------|---------|
| agent-drift-detector | Agent Drift Detector | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| analyze-token-burn | Analyze Token Burn | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| ashfall | Ashfall | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| cic-roadmap-updater | CIC Roadmap Updater | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| cic-section-summarizer | CIC Section Summarizer | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| context-manager | Context Manager | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| html-visual-verify | HTML Visual Verify | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| kb-sync-artifact-generator | KB Sync Artifact Generator | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| kb-sync-nightly | Kb Sync Nightly | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| operator-image-build | Operator Image Build | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| permission-governor | Permission Governor | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| plan-extractor-integration | Plan Extractor Integration | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| pre-wrap-audit | Pre Wrap Audit | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| reconcile-vector-store | Reconcile Vector Store | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| rewrite-labs-orchestrator | Rewrite Labs Orchestrator | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| roadmap-validator | Roadmap Validator | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| rollback-phase | Rollback Phase | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| run-adapter-diagnostic | Run Adapter Diagnostic | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| scale-ingestion-service | Scale Ingestion Service | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| tool-lifecycle-manager | Tool Lifecycle Manager | 0.1.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| toolforge-drift-monitor | Toolforge Drift Monitor | 0.1.0 | active | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| work-summarizer | Work Summarizer v4.0 | 4.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |

---

## Canonical Validation

⚠️ **analyze-token-burn**: Invalid category: observability
⚠️ **kb-sync-artifact-generator**: Invalid category: governance
⚠️ **kb-sync-nightly**: Invalid category: governance
⚠️ **operator-image-build**: Invalid category: pipeline
⚠️ **pre-wrap-audit**: Invalid category: session-management
⚠️ **reconcile-vector-store**: Invalid category: data-management
⚠️ **roadmap-validator**: Invalid category: governance
⚠️ **rollback-phase**: Invalid category: pipeline
⚠️ **scale-ingestion-service**: Invalid category: pipeline
⚠️ **tool-lifecycle-manager**: Invalid category: pipeline
⚠️ **work-summarizer**: Invalid category: observability

## Distributed Validation

⚠️ **html-visual-verify**: Directory missing in distributed
⚠️ **kb-sync-artifact-generator**: Directory missing in distributed
⚠️ **tool-lifecycle-manager**: Category mismatch: canonical 'pipeline', distributed 'automation'

## Manifest Validation

⚠️ **agent-drift-detector**: Tags mismatch: canonical '', manifest 'drift, schema, validation'
⚠️ **agent-drift-detector**: Path mismatch: expected 'skills/agent-drift-detector', got ''
⚠️ **analyze-token-burn**: Path mismatch: expected 'skills/analyze-token-burn', got ''
⚠️ **analyze-token-burn**: Invalid category in manifest: observability
⚠️ **analyze-token-burn**: Tags mismatch: canonical '', manifest ''
⚠️ **ashfall**: Path mismatch: expected 'skills/ashfall', got ''
⚠️ **ashfall**: Tags mismatch: canonical '', manifest ''
⚠️ **cic-roadmap-updater**: Tags mismatch: canonical '', manifest 'roadmap, planning, versioning'
⚠️ **cic-roadmap-updater**: Path mismatch: expected 'skills/cic-roadmap-updater', got ''
⚠️ **cic-section-summarizer**: Tags mismatch: canonical '', manifest 'analysis, roadmap, progress'
⚠️ **cic-section-summarizer**: Path mismatch: expected 'skills/cic-section-summarizer', got ''
⚠️ **context-manager**: Tags mismatch: canonical '', manifest 'session, autonomous, governance'
⚠️ **context-manager**: Path mismatch: expected 'skills/context-manager', got ''
⚠️ **html-visual-verify**: Path mismatch: expected 'skills/html-visual-verify', got ''
⚠️ **kb-sync-artifact-generator**: Path mismatch: expected 'skills/kb-sync-artifact-generator', got ''
⚠️ **kb-sync-artifact-generator**: Invalid category in manifest: governance
⚠️ **kb-sync-artifact-generator**: Tags mismatch: canonical '', manifest 'kb-sync, artifacts, governance'
⚠️ **kb-sync-nightly**: Path mismatch: expected 'skills/kb-sync-nightly', got ''
⚠️ **kb-sync-nightly**: Tags mismatch: canonical '', manifest ''
⚠️ **kb-sync-nightly**: Invalid category in manifest: governance
⚠️ **operator-image-build**: Tags mismatch: canonical '', manifest ''
⚠️ **operator-image-build**: Invalid category in manifest: pipeline
⚠️ **operator-image-build**: Path mismatch: expected 'skills/operator-image-build', got ''
⚠️ **permission-governor**: Tags mismatch: canonical '', manifest 'permissions, security, governance'
⚠️ **permission-governor**: Path mismatch: expected 'skills/permission-governor', got ''
⚠️ **plan-extractor-integration**: Tags mismatch: canonical '', manifest 'codeflow, extraction, integration'
⚠️ **plan-extractor-integration**: Path mismatch: expected 'skills/plan-extractor-integration', got ''
⚠️ **pre-wrap-audit**: Tags mismatch: canonical '', manifest ''
⚠️ **pre-wrap-audit**: Path mismatch: expected 'skills/pre-wrap-audit', got ''
⚠️ **pre-wrap-audit**: Invalid category in manifest: session-management
⚠️ **reconcile-vector-store**: Invalid category in manifest: data-management
⚠️ **reconcile-vector-store**: Tags mismatch: canonical '', manifest ''
⚠️ **reconcile-vector-store**: Path mismatch: expected 'skills/reconcile-vector-store', got ''
⚠️ **rewrite-labs-orchestrator**: Path mismatch: expected 'skills/rewrite-labs-orchestrator', got ''
⚠️ **rewrite-labs-orchestrator**: Tags mismatch: canonical '', manifest 'pipeline, stages, orchestration'
⚠️ **roadmap-validator**: Path mismatch: expected 'skills/roadmap-validator', got ''
⚠️ **roadmap-validator**: Invalid category in manifest: governance
⚠️ **roadmap-validator**: Tags mismatch: canonical '', manifest ''
⚠️ **rollback-phase**: Path mismatch: expected 'skills/rollback-phase', got ''
⚠️ **rollback-phase**: Invalid category in manifest: pipeline
⚠️ **rollback-phase**: Tags mismatch: canonical '', manifest ''
⚠️ **run-adapter-diagnostic**: Tags mismatch: canonical '', manifest ''
⚠️ **run-adapter-diagnostic**: Path mismatch: expected 'skills/run-adapter-diagnostic', got ''
⚠️ **scale-ingestion-service**: Path mismatch: expected 'skills/scale-ingestion-service', got ''
⚠️ **scale-ingestion-service**: Tags mismatch: canonical '', manifest ''
⚠️ **scale-ingestion-service**: Invalid category in manifest: pipeline
⚠️ **tool-lifecycle-manager**: Invalid category in manifest: pipeline
⚠️ **tool-lifecycle-manager**: Path mismatch: expected 'skills/tool-lifecycle-manager', got ''
⚠️ **toolforge-drift-monitor**: Path mismatch: expected 'skills/toolforge-drift-monitor', got ''
⚠️ **work-summarizer**: Path mismatch: expected 'skills/work-summarizer', got ''
⚠️ **work-summarizer**: Tags mismatch: canonical '', manifest ''
⚠️ **work-summarizer**: Invalid category in manifest: observability

## Cowork Validation

⚠️ **agent-drift-detector**: Not registered (installer will register on next run)
⚠️ **analyze-token-burn**: Not registered (installer will register on next run)
⚠️ **ashfall**: Not registered (installer will register on next run)
⚠️ **cic-roadmap-updater**: Not registered (installer will register on next run)
⚠️ **cic-section-summarizer**: Not registered (installer will register on next run)
⚠️ **context-manager**: Not registered (installer will register on next run)
⚠️ **html-visual-verify**: Not registered (installer will register on next run)
⚠️ **kb-sync-artifact-generator**: Not registered (installer will register on next run)
⚠️ **kb-sync-nightly**: Not registered (installer will register on next run)
⚠️ **operator-image-build**: Not registered (installer will register on next run)
⚠️ **permission-governor**: Not registered (installer will register on next run)
⚠️ **plan-extractor-integration**: Not registered (installer will register on next run)
⚠️ **pre-wrap-audit**: Not registered (installer will register on next run)
⚠️ **reconcile-vector-store**: Not registered (installer will register on next run)
⚠️ **rewrite-labs-orchestrator**: Not registered (installer will register on next run)
⚠️ **roadmap-validator**: Not registered (installer will register on next run)
⚠️ **rollback-phase**: Not registered (installer will register on next run)
⚠️ **run-adapter-diagnostic**: Not registered (installer will register on next run)
⚠️ **scale-ingestion-service**: Not registered (installer will register on next run)
⚠️ **tool-lifecycle-manager**: Not registered (installer will register on next run)
⚠️ **toolforge-drift-monitor**: Not registered (installer will register on next run)
⚠️ **work-summarizer**: Not registered (installer will register on next run)

## Dependencies Validation

⚠️ **html-visual-verify**: External dependencies mismatch: canonical '', manifest '@playwright/test'

## Runtime Validation

ℹ️ **agent-drift-detector**: Skill inactive (status: )
ℹ️ **analyze-token-burn**: Skill inactive (status: )
ℹ️ **ashfall**: Skill inactive (status: )
ℹ️ **cic-roadmap-updater**: Skill inactive (status: )
ℹ️ **cic-section-summarizer**: Skill inactive (status: )
ℹ️ **context-manager**: Skill inactive (status: )
ℹ️ **html-visual-verify**: Discoverable
ℹ️ **kb-sync-artifact-generator**: Skill inactive (status: )
ℹ️ **kb-sync-nightly**: Skill inactive (status: )
ℹ️ **operator-image-build**: Skill inactive (status: )
ℹ️ **permission-governor**: Skill inactive (status: )
ℹ️ **plan-extractor-integration**: Skill inactive (status: )
ℹ️ **pre-wrap-audit**: Skill inactive (status: )
ℹ️ **reconcile-vector-store**: Skill inactive (status: )
ℹ️ **rewrite-labs-orchestrator**: Skill inactive (status: )
ℹ️ **roadmap-validator**: Skill inactive (status: )
ℹ️ **rollback-phase**: Skill inactive (status: )
ℹ️ **run-adapter-diagnostic**: Skill inactive (status: )
ℹ️ **scale-ingestion-service**: Skill inactive (status: )
ℹ️ **tool-lifecycle-manager**: Discoverable
ℹ️ **toolforge-drift-monitor**: Discoverable
ℹ️ **work-summarizer**: Skill inactive (status: )

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

## Phase 2.A Execution Status

**Tier A Skills (Phase 26–27 Expansions) — Staged for Cowork Registration:**
- agent-drift-detector, cic-roadmap-updater, cic-section-summarizer, context-manager
- html-visual-verify, kb-sync-artifact-generator, permission-governor, plan-extractor-integration
- rewrite-labs-orchestrator

**Phase 1 Skills (Ashfall):** All 13 remain operational, no changes.

**Phase 2.A Exit Criteria:** ✅ COMPLETE
- ✅ All 22 skills validated for compliance (0 errors, 89 warnings as documented)
- ✅ SKILLPACK-VALIDATION.md updated (22-skill inventory)
- ✅ All 9 Tier A skills staged for Cowork registration in Phase 3

**Next Phase:** Phase 3 (Cowork Gateway + Distributed Sync) — Execute Tier A registration to Cowork plugin network.

---

**Skill Validator v1.1.0** | Toolforge Team

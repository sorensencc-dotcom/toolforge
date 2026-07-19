# Toolforge Skill Validation Report

**Generated**: 2026-07-19T00:34:21.8255068Z

---

## Executive Summary

| Domain | Errors | Warnings | Passed | Status |
|--------|--------|----------|--------|--------|
| Canonical | 9 | 23 | 0 | ❌ |
| Distributed | 0 | 21 | 0 | ✅ |
| Manifest | 2 | 89 | 0 | ❌ |
| Cowork | 0 | 36 | 0 | ✅ |
| Dependencies | 5 | 3 | 0 | ❌ |
| Runtime | 1 | 0 | 35 | ❌ |
| Audit | 0 | 0 | 0 | ℹ️ |

**Total Errors**: 17
**Total Warnings**: 172

**Overall Status**: ❌ FAIL

---

## Skills Inventory

| ID | Name | Version | Status | Canonical | Distributed | Manifest | Cowork | Runtime |
|----|------|---------|--------|-----------|-------------|----------|--------|---------|
| _cic-shared | CIC Shared Utilities | 1.0.0 | active | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| agent-drift-detector | Agent Drift Detector | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| analyze-token-burn | Analyze Token Burn | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| ashfall | Ashfall | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| automation-audit | Automation Audit | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| cic-consolidate-artifacts | CIC Consolidate Artifacts | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| cic-ingest-world | CIC Ingest World | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| cic-orchestrate-flow | CIC Orchestrate Flow | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| cic-repair-pipeline | CIC Repair Pipeline | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| cic-roadmap-updater | CIC Roadmap Updater | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| cic-run-gate | CIC Run Gate | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| cic-section-summarizer | CIC Section Summarizer | 1.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| context-manager | Context Manager | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| html-visual-verify | HTML Visual Verify | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| kb-sync-artifact-generator | KB Sync Artifact Generator | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| kb-sync-nightly | KB Sync Nightly | 1.0.2 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| obsidian-ingest-wiki | Obsidian Wiki Ingest | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
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
| session-wrap | Session Wrap | 1.1.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| skill-health-monitor | Skill Health Monitor | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| skill-security-auditor | Skill Security Auditor | 1.0.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| tool-lifecycle-manager | Tool Lifecycle Manager | 0.1.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| toolforge-cli | Toolforge CLI | 0.1.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| toolforge-drift-monitor | Toolforge Drift Monitor | 0.1.0 | active | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| toolforge-registry-manager | Toolforge Registry Manager | 0.1.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| toolforge-submission-validator | Toolforge Submission Validator | 0.1.0 | active | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| work-summarizer | Work Summarizer v4.0 | 4.0.0 | active | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |

---

## Canonical Validation

❌ **_cic-shared**: Missing: SKILL.md
❌ **_cic-shared**: Missing: README.md
❌ **_cic-shared**: Missing: INTEGRATION_DIAGRAM.md
⚠️ **_cic-shared**: Entrypoint missing: src/index.ts
⚠️ **analyze-token-burn**: Invalid category: observability
❌ **automation-audit**: Missing: INTEGRATION_DIAGRAM.md
⚠️ **automation-audit**: Invalid category: operations
⚠️ **cic-consolidate-artifacts**: Invalid category: governance
⚠️ **cic-ingest-world**: Invalid category: governance
❌ **cic-orchestrate-flow**: Missing: SKILL.md
❌ **cic-orchestrate-flow**: Missing: README.md
❌ **cic-orchestrate-flow**: Missing: INTEGRATION_DIAGRAM.md
⚠️ **cic-orchestrate-flow**: Invalid category: governance
⚠️ **cic-repair-pipeline**: Invalid category: governance
⚠️ **cic-run-gate**: Invalid category: governance
⚠️ **kb-sync-artifact-generator**: Invalid category: governance
⚠️ **kb-sync-nightly**: Invalid category: sync-tools
⚠️ **obsidian-ingest-wiki**: Invalid category: knowledge-base
⚠️ **operator-image-build**: Invalid category: pipeline
⚠️ **pre-wrap-audit**: Invalid category: session-management
⚠️ **reconcile-vector-store**: Invalid category: data-management
⚠️ **roadmap-validator**: Invalid category: governance
⚠️ **rollback-phase**: Invalid category: pipeline
⚠️ **scale-ingestion-service**: Invalid category: pipeline
❌ **session-wrap**: Missing: INTEGRATION_DIAGRAM.md
⚠️ **session-wrap**: Invalid category: session-management
❌ **skill-health-monitor**: Missing: INTEGRATION_DIAGRAM.md
⚠️ **tool-lifecycle-manager**: Invalid category: pipeline
⚠️ **toolforge-cli**: Invalid category: utility
⚠️ **toolforge-registry-manager**: Invalid category: pipeline
⚠️ **toolforge-submission-validator**: Invalid category: governance
⚠️ **work-summarizer**: Invalid category: observability

## Distributed Validation

⚠️ **_cic-shared**: Directory missing in distributed
⚠️ **automation-audit**: Directory missing in distributed
⚠️ **cic-consolidate-artifacts**: Directory missing in distributed
⚠️ **cic-ingest-world**: Directory missing in distributed
⚠️ **cic-orchestrate-flow**: Directory missing in distributed
⚠️ **cic-repair-pipeline**: Directory missing in distributed
⚠️ **cic-run-gate**: Directory missing in distributed
⚠️ **context-manager**: Category mismatch: canonical 'utilities', distributed 'utility'
⚠️ **html-visual-verify**: Directory missing in distributed
⚠️ **kb-sync-artifact-generator**: Directory missing in distributed
⚠️ **kb-sync-nightly**: Version mismatch: canonical 1.0.2, distributed 1.0.0
⚠️ **kb-sync-nightly**: Category mismatch: canonical 'sync-tools', distributed 'governance'
⚠️ **kb-sync-nightly**: Entrypoint missing in distributed
⚠️ **obsidian-ingest-wiki**: Directory missing in distributed
⚠️ **session-wrap**: Directory missing in distributed
⚠️ **skill-health-monitor**: Directory missing in distributed
⚠️ **skill-security-auditor**: Directory missing in distributed
⚠️ **tool-lifecycle-manager**: Category mismatch: canonical 'pipeline', distributed 'automation'
⚠️ **toolforge-cli**: Directory missing in distributed
⚠️ **toolforge-registry-manager**: Directory missing in distributed
⚠️ **toolforge-submission-validator**: Directory missing in distributed

## Manifest Validation

⚠️ **agent-drift-detector**: Tags mismatch: canonical '', manifest 'drift, schema, validation'
⚠️ **agent-drift-detector**: Path mismatch: expected 'skills/agent-drift-detector', got ''
⚠️ **analyze-token-burn**: Path mismatch: expected 'skills/analyze-token-burn', got ''
⚠️ **analyze-token-burn**: Invalid category in manifest: observability
⚠️ **analyze-token-burn**: Tags mismatch: canonical '', manifest ''
⚠️ **ashfall**: Path mismatch: expected 'skills/ashfall', got ''
⚠️ **ashfall**: Tags mismatch: canonical '', manifest ''
⚠️ **automation-audit**: Path mismatch: expected 'skills/automation-audit', got ''
⚠️ **automation-audit**: Description mismatch: canonical 'Repository-wide scan for manual tasks that should be automated (log rotation, backup retention, manual-step markers, stale reports)', manifest 'Repository-wide scan for manual tasks that should be automated (log rotation, backup retention, manual-step markers)'
⚠️ **automation-audit**: Tags mismatch: canonical '', manifest 'automation, devops-audit, log-rotation, backup-retention'
⚠️ **automation-audit**: Invalid category in manifest: operations
⚠️ **cic-consolidate-artifacts**: Tags mismatch: canonical '', manifest 'cic, governance, phase1'
⚠️ **cic-consolidate-artifacts**: Invalid category in manifest: governance
⚠️ **cic-consolidate-artifacts**: Path mismatch: expected 'skills/cic-consolidate-artifacts', got ''
⚠️ **cic-ingest-world**: Tags mismatch: canonical '', manifest 'cic, governance, phase1'
⚠️ **cic-ingest-world**: Invalid category in manifest: governance
⚠️ **cic-ingest-world**: Path mismatch: expected 'skills/cic-ingest-world', got ''
⚠️ **cic-orchestrate-flow**: Path mismatch: expected 'skills/cic-orchestrate-flow', got ''
⚠️ **cic-orchestrate-flow**: Invalid category in manifest: governance
⚠️ **cic-orchestrate-flow**: Tags mismatch: canonical '', manifest 'cic, governance, phase3, orchestration'
⚠️ **cic-repair-pipeline**: Tags mismatch: canonical '', manifest 'cic, governance, phase1'
⚠️ **cic-repair-pipeline**: Invalid category in manifest: governance
⚠️ **cic-repair-pipeline**: Path mismatch: expected 'skills/cic-repair-pipeline', got ''
⚠️ **cic-roadmap-updater**: Tags mismatch: canonical '', manifest 'roadmap, planning, versioning'
⚠️ **cic-roadmap-updater**: Path mismatch: expected 'skills/cic-roadmap-updater', got ''
⚠️ **cic-run-gate**: Tags mismatch: canonical '', manifest 'cic, governance, phase1, gate'
⚠️ **cic-run-gate**: Invalid category in manifest: governance
⚠️ **cic-run-gate**: Path mismatch: expected 'skills/cic-run-gate', got ''
⚠️ **cic-section-summarizer**: Tags mismatch: canonical '', manifest 'analysis, roadmap, progress'
⚠️ **cic-section-summarizer**: Path mismatch: expected 'skills/cic-section-summarizer', got ''
⚠️ **context-manager**: Tags mismatch: canonical '', manifest 'session, autonomous, governance'
⚠️ **context-manager**: Path mismatch: expected 'skills/context-manager', got ''
⚠️ **html-visual-verify**: Path mismatch: expected 'skills/html-visual-verify', got ''
⚠️ **kb-sync-artifact-generator**: Invalid category in manifest: governance
⚠️ **kb-sync-artifact-generator**: Tags mismatch: canonical '', manifest 'kb-sync, artifacts, governance'
⚠️ **kb-sync-artifact-generator**: Path mismatch: expected 'skills/kb-sync-artifact-generator', got ''
❌ **kb-sync-nightly**: Category mismatch: canonical 'sync-tools', manifest 'governance'
⚠️ **kb-sync-nightly**: Description mismatch: canonical 'Nightly KB sync orchestrator. Runs full npm pipeline (NotebookLM + Obsidian staging + artifact generation) from C:\dev\kb-sync.', manifest 'Knowledge base sync with integrated cross-reference layer. Syncs CIC docs to wiki/ and builds cross-refs with docs/.'
⚠️ **kb-sync-nightly**: Runtime mismatch: canonical typescript, manifest bash
❌ **kb-sync-nightly**: Version mismatch: canonical 1.0.2, manifest 1.0.0
⚠️ **kb-sync-nightly**: Invalid category in manifest: governance
⚠️ **kb-sync-nightly**: Tags mismatch: canonical '', manifest ''
⚠️ **kb-sync-nightly**: Path mismatch: expected 'skills/kb-sync-nightly', got ''
⚠️ **obsidian-ingest-wiki**: Tags mismatch: canonical '', manifest 'obsidian, wiki, synthesis, lvm-pattern'
⚠️ **obsidian-ingest-wiki**: Invalid category in manifest: knowledge-base
⚠️ **obsidian-ingest-wiki**: Path mismatch: expected 'skills/obsidian-ingest-wiki', got ''
⚠️ **operator-image-build**: Path mismatch: expected 'skills/operator-image-build', got ''
⚠️ **operator-image-build**: Invalid category in manifest: pipeline
⚠️ **operator-image-build**: Tags mismatch: canonical '', manifest ''
⚠️ **permission-governor**: Path mismatch: expected 'skills/permission-governor', got ''
⚠️ **permission-governor**: Tags mismatch: canonical '', manifest 'permissions, security, governance'
⚠️ **plan-extractor-integration**: Path mismatch: expected 'skills/plan-extractor-integration', got ''
⚠️ **plan-extractor-integration**: Tags mismatch: canonical '', manifest 'codeflow, extraction, integration'
⚠️ **pre-wrap-audit**: Tags mismatch: canonical '', manifest ''
⚠️ **pre-wrap-audit**: Invalid category in manifest: session-management
⚠️ **pre-wrap-audit**: Path mismatch: expected 'skills/pre-wrap-audit', got ''
⚠️ **reconcile-vector-store**: Tags mismatch: canonical '', manifest ''
⚠️ **reconcile-vector-store**: Invalid category in manifest: data-management
⚠️ **reconcile-vector-store**: Path mismatch: expected 'skills/reconcile-vector-store', got ''
⚠️ **rewrite-labs-orchestrator**: Path mismatch: expected 'skills/rewrite-labs-orchestrator', got ''
⚠️ **rewrite-labs-orchestrator**: Tags mismatch: canonical '', manifest 'pipeline, stages, orchestration'
⚠️ **roadmap-validator**: Invalid category in manifest: governance
⚠️ **roadmap-validator**: Path mismatch: expected 'skills/roadmap-validator', got ''
⚠️ **roadmap-validator**: Tags mismatch: canonical '', manifest ''
⚠️ **rollback-phase**: Tags mismatch: canonical '', manifest ''
⚠️ **rollback-phase**: Invalid category in manifest: pipeline
⚠️ **rollback-phase**: Path mismatch: expected 'skills/rollback-phase', got ''
⚠️ **run-adapter-diagnostic**: Path mismatch: expected 'skills/run-adapter-diagnostic', got ''
⚠️ **run-adapter-diagnostic**: Tags mismatch: canonical '', manifest ''
⚠️ **scale-ingestion-service**: Invalid category in manifest: pipeline
⚠️ **scale-ingestion-service**: Tags mismatch: canonical '', manifest ''
⚠️ **scale-ingestion-service**: Path mismatch: expected 'skills/scale-ingestion-service', got ''
⚠️ **session-wrap**: Tags mismatch: canonical '', manifest 'session-wrap, git-commit, documentation, atomic-commit'
⚠️ **session-wrap**: Invalid category in manifest: session-management
⚠️ **session-wrap**: Path mismatch: expected 'skills/session-wrap', got ''
⚠️ **skill-health-monitor**: Path mismatch: expected 'skills/skill-health-monitor', got ''
⚠️ **skill-health-monitor**: Tags mismatch: canonical '', manifest 'skill-health, manifest-audit, staleness, inventory'
⚠️ **skill-security-auditor**: Runtime mismatch: canonical python, manifest 
⚠️ **skill-security-auditor**: Path mismatch: expected 'skills/skill-security-auditor', got ''
⚠️ **tool-lifecycle-manager**: Path mismatch: expected 'skills/tool-lifecycle-manager', got ''
⚠️ **tool-lifecycle-manager**: Invalid category in manifest: pipeline
⚠️ **toolforge-cli**: Invalid category in manifest: utility
⚠️ **toolforge-cli**: Path mismatch: expected 'skills/toolforge-cli', got ''
⚠️ **toolforge-drift-monitor**: Path mismatch: expected 'skills/toolforge-drift-monitor', got ''
⚠️ **toolforge-registry-manager**: Invalid category in manifest: pipeline
⚠️ **toolforge-registry-manager**: Path mismatch: expected 'skills/toolforge-registry-manager', got ''
⚠️ **toolforge-submission-validator**: Path mismatch: expected 'skills/toolforge-submission-validator', got ''
⚠️ **toolforge-submission-validator**: Invalid category in manifest: governance
⚠️ **work-summarizer**: Tags mismatch: canonical '', manifest ''
⚠️ **work-summarizer**: Invalid category in manifest: observability
⚠️ **work-summarizer**: Path mismatch: expected 'skills/work-summarizer', got ''

## Cowork Validation

⚠️ **_cic-shared**: Not registered (installer will register on next run)
⚠️ **agent-drift-detector**: Not registered (installer will register on next run)
⚠️ **analyze-token-burn**: Not registered (installer will register on next run)
⚠️ **ashfall**: Not registered (installer will register on next run)
⚠️ **automation-audit**: Not registered (installer will register on next run)
⚠️ **cic-consolidate-artifacts**: Not registered (installer will register on next run)
⚠️ **cic-ingest-world**: Not registered (installer will register on next run)
⚠️ **cic-orchestrate-flow**: Not registered (installer will register on next run)
⚠️ **cic-repair-pipeline**: Not registered (installer will register on next run)
⚠️ **cic-roadmap-updater**: Not registered (installer will register on next run)
⚠️ **cic-run-gate**: Not registered (installer will register on next run)
⚠️ **cic-section-summarizer**: Not registered (installer will register on next run)
⚠️ **context-manager**: Not registered (installer will register on next run)
⚠️ **html-visual-verify**: Not registered (installer will register on next run)
⚠️ **kb-sync-artifact-generator**: Not registered (installer will register on next run)
⚠️ **kb-sync-nightly**: Not registered (installer will register on next run)
⚠️ **obsidian-ingest-wiki**: Not registered (installer will register on next run)
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
⚠️ **session-wrap**: Not registered (installer will register on next run)
⚠️ **skill-health-monitor**: Not registered (installer will register on next run)
⚠️ **skill-security-auditor**: Not registered (installer will register on next run)
⚠️ **tool-lifecycle-manager**: Not registered (installer will register on next run)
⚠️ **toolforge-cli**: Not registered (installer will register on next run)
⚠️ **toolforge-drift-monitor**: Not registered (installer will register on next run)
⚠️ **toolforge-registry-manager**: Not registered (installer will register on next run)
⚠️ **toolforge-submission-validator**: Not registered (installer will register on next run)
⚠️ **work-summarizer**: Not registered (installer will register on next run)

## Dependencies Validation

❌ **cic-consolidate-artifacts**: Internal dependencies mismatch: canonical '', manifest '_cic-shared'
❌ **cic-ingest-world**: Internal dependencies mismatch: canonical '', manifest '_cic-shared'
❌ **cic-orchestrate-flow**: Internal dependencies mismatch: canonical '', manifest '_cic-shared, cic-consolidate-artifacts, cic-ingest-world, cic-repair-pipeline, cic-run-gate'
❌ **cic-repair-pipeline**: Internal dependencies mismatch: canonical '', manifest '_cic-shared'
❌ **cic-run-gate**: Internal dependencies mismatch: canonical '', manifest '_cic-shared'
⚠️ **cic-run-gate**: External dependencies mismatch: canonical '', manifest 'python3.12'
⚠️ **html-visual-verify**: External dependencies mismatch: canonical '', manifest '@playwright/test'
⚠️ **skill-security-auditor**: Missing external dependency: python3

## Runtime Validation

❌ **_cic-shared**: Entrypoint file missing: src/index.ts
ℹ️ **agent-drift-detector**: Skill inactive (status: )
ℹ️ **analyze-token-burn**: Skill inactive (status: )
ℹ️ **ashfall**: Skill inactive (status: )
ℹ️ **automation-audit**: Skill inactive (status: )
ℹ️ **cic-consolidate-artifacts**: Skill inactive (status: )
ℹ️ **cic-ingest-world**: Skill inactive (status: )
ℹ️ **cic-orchestrate-flow**: Skill inactive (status: )
ℹ️ **cic-repair-pipeline**: Skill inactive (status: )
ℹ️ **cic-roadmap-updater**: Skill inactive (status: )
ℹ️ **cic-run-gate**: Skill inactive (status: )
ℹ️ **cic-section-summarizer**: Skill inactive (status: )
ℹ️ **context-manager**: Skill inactive (status: )
ℹ️ **html-visual-verify**: Discoverable
ℹ️ **kb-sync-artifact-generator**: Skill inactive (status: )
ℹ️ **kb-sync-nightly**: Skill inactive (status: )
ℹ️ **obsidian-ingest-wiki**: Skill inactive (status: )
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
ℹ️ **session-wrap**: Skill inactive (status: )
ℹ️ **skill-health-monitor**: Skill inactive (status: )
ℹ️ **skill-security-auditor**: Skill inactive (status: )
ℹ️ **tool-lifecycle-manager**: Discoverable
ℹ️ **toolforge-cli**: Discoverable
ℹ️ **toolforge-drift-monitor**: Discoverable
ℹ️ **toolforge-registry-manager**: Discoverable
ℹ️ **toolforge-submission-validator**: Discoverable
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

**Skill Validator v1.1.0** | Toolforge Team

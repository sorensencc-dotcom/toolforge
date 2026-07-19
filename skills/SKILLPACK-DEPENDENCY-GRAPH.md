# Toolforge Skill Dependency Graph

**Generated:** 2026-07-19T01:21:45.8133258Z

**Phase:** 1.4 — Dependency Graph Implementation

---

## Summary

| Metric | Value |
|--------|-------|
| Total Skills | 36 |
| Total Dependencies | 3 |
| Max Depth | 1 |
| Cyclic Skills | 0 |
| Missing Internal Deps | 0 |
| Orphan Skills | 33 |

---

## Adjacency List

### Outbound Dependencies (Skill → Dependencies)

### _cic-shared

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### agent-drift-detector

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### analyze-token-burn

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### ashfall

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### automation-audit

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-consolidate-artifacts

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-ingest-world

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-orchestrate-flow

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-repair-pipeline

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-roadmap-updater

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-run-gate

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-section-summarizer

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### context-manager

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### html-visual-verify

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### kb-sync-artifact-generator

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### kb-sync-nightly

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### obsidian-ingest-wiki

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### operator-image-build

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### permission-governor

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### plan-extractor-integration

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### pre-wrap-audit

| Dependency | Type | Status |
|------------|------|--------|
| ashfall | internal | ✅ Found |

### reconcile-vector-store

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### rewrite-labs-orchestrator

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### roadmap-validator

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### rollback-phase

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### run-adapter-diagnostic

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### scale-ingestion-service

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### session-wrap

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### skill-health-monitor

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### skill-security-auditor

| Dependency | Type | Status |
|------------|------|--------|
| python3 | external | ❌ Missing |

### tool-lifecycle-manager

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### toolforge-cli

| Dependency | Type | Status |
|------------|------|--------|
| toolforge-registry-manager | internal | ✅ Found |
| toolforge-submission-validator | internal | ✅ Found |

### toolforge-drift-monitor

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### toolforge-registry-manager

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### toolforge-submission-validator

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### work-summarizer

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### Inbound Dependencies (What Depends on Each Skill)

### _cic-shared

No inbound dependencies (root skill)\n
### agent-drift-detector

No inbound dependencies (root skill)\n
### analyze-token-burn

No inbound dependencies (root skill)\n
### ashfall

| Dependent | Type |
|-----------|------|
| pre-wrap-audit | internal |

### automation-audit

No inbound dependencies (root skill)\n
### cic-consolidate-artifacts

No inbound dependencies (root skill)\n
### cic-ingest-world

No inbound dependencies (root skill)\n
### cic-orchestrate-flow

No inbound dependencies (root skill)\n
### cic-repair-pipeline

No inbound dependencies (root skill)\n
### cic-roadmap-updater

No inbound dependencies (root skill)\n
### cic-run-gate

No inbound dependencies (root skill)\n
### cic-section-summarizer

No inbound dependencies (root skill)\n
### context-manager

No inbound dependencies (root skill)\n
### html-visual-verify

No inbound dependencies (root skill)\n
### kb-sync-artifact-generator

No inbound dependencies (root skill)\n
### kb-sync-nightly

No inbound dependencies (root skill)\n
### obsidian-ingest-wiki

No inbound dependencies (root skill)\n
### operator-image-build

No inbound dependencies (root skill)\n
### permission-governor

No inbound dependencies (root skill)\n
### plan-extractor-integration

No inbound dependencies (root skill)\n
### pre-wrap-audit

No inbound dependencies (root skill)\n
### reconcile-vector-store

No inbound dependencies (root skill)\n
### rewrite-labs-orchestrator

No inbound dependencies (root skill)\n
### roadmap-validator

No inbound dependencies (root skill)\n
### rollback-phase

No inbound dependencies (root skill)\n
### run-adapter-diagnostic

No inbound dependencies (root skill)\n
### scale-ingestion-service

No inbound dependencies (root skill)\n
### session-wrap

No inbound dependencies (root skill)\n
### skill-health-monitor

No inbound dependencies (root skill)\n
### skill-security-auditor

No inbound dependencies (root skill)\n
### tool-lifecycle-manager

No inbound dependencies (root skill)\n
### toolforge-cli

No inbound dependencies (root skill)\n
### toolforge-drift-monitor

No inbound dependencies (root skill)\n
### toolforge-registry-manager

| Dependent | Type |
|-----------|------|
| toolforge-cli | internal |

### toolforge-submission-validator

| Dependent | Type |
|-----------|------|
| toolforge-cli | internal |

### work-summarizer

No inbound dependencies (root skill)\n
---

## Dependency Depth (Leaf → Root)

Depth 0 = Leaf node (no dependencies)
Depth N = Depends on at least one skill at depth N-1

| Skill | Depth |
|-------|-------|| skill-security-auditor | 1 |
| toolforge-cli | 1 |
| pre-wrap-audit | 1 |
| cic-run-gate | 0 |
| work-summarizer | 0 |
| rollback-phase | 0 |
| analyze-token-burn | 0 |
| scale-ingestion-service | 0 |
| cic-orchestrate-flow | 0 |
| ashfall | 0 |
| agent-drift-detector | 0 |
| toolforge-drift-monitor | 0 |
| _cic-shared | 0 |
| html-visual-verify | 0 |
| context-manager | 0 |
| cic-repair-pipeline | 0 |
| toolforge-registry-manager | 0 |
| kb-sync-nightly | 0 |
| rewrite-labs-orchestrator | 0 |
| permission-governor | 0 |
| session-wrap | 0 |
| tool-lifecycle-manager | 0 |
| toolforge-submission-validator | 0 |
| operator-image-build | 0 |
| run-adapter-diagnostic | 0 |
| cic-section-summarizer | 0 |
| reconcile-vector-store | 0 |
| roadmap-validator | 0 |
| obsidian-ingest-wiki | 0 |
| cic-consolidate-artifacts | 0 |
| skill-health-monitor | 0 |
| plan-extractor-integration | 0 |
| cic-roadmap-updater | 0 |
| automation-audit | 0 |
| kb-sync-artifact-generator | 0 |
| cic-ingest-world | 0 |

---

## Cycles (Circular Dependencies)
✅ No cycles detected.\n
---

## Missing Internal Dependencies

Dependencies referenced but not found in canonical skills.
✅ All internal dependencies resolved.\n
---

## Orphan Skills

Skills that have no inbound dependencies (nothing depends on them).
| Skill |
|-------|
| _cic-shared |
| agent-drift-detector |
| analyze-token-burn |
| automation-audit |
| cic-consolidate-artifacts |
| cic-ingest-world |
| cic-orchestrate-flow |
| cic-repair-pipeline |
| cic-roadmap-updater |
| cic-run-gate |
| cic-section-summarizer |
| context-manager |
| html-visual-verify |
| kb-sync-artifact-generator |
| kb-sync-nightly |
| obsidian-ingest-wiki |
| operator-image-build |
| permission-governor |
| plan-extractor-integration |
| pre-wrap-audit |
| reconcile-vector-store |
| rewrite-labs-orchestrator |
| roadmap-validator |
| rollback-phase |
| run-adapter-diagnostic |
| scale-ingestion-service |
| session-wrap |
| skill-health-monitor |
| skill-security-auditor |
| tool-lifecycle-manager |
| toolforge-cli |
| toolforge-drift-monitor |
| work-summarizer |

---

## Health Summary

| Category | Status | Details |
|----------|--------|---------|
| Cycles | ✅ PASS | 0 cycle(s) detected |
| Missing Deps | ✅ PASS | 0 missing dep(s) |
| Orphans | ⚠️ WARN | 33 orphan skill(s) |

---

**Report generated by 	oolforgeDependencyGraph.ps1 — Phase 1.4**


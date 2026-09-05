# Toolforge Skill Dependency Graph

**Generated:** 2026-09-03T02:53:34.6216080Z

**Phase:** 1.4 — Dependency Graph Implementation

---

## Summary

| Metric | Value |
|--------|-------|
| Total Skills | 50 |
| Total Dependencies | 13 |
| Max Depth | 2 |
| Cyclic Skills | 0 |
| Missing Internal Deps | 0 |
| Orphan Skills | 41 |

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
| _cic-shared | internal | ✅ Found |

### cic-ingest-world

| Dependency | Type | Status |
|------------|------|--------|
| _cic-shared | internal | ✅ Found |

### cic-orchestrate-flow

| Dependency | Type | Status |
|------------|------|--------|
| _cic-shared | internal | ✅ Found |
| cic-consolidate-artifacts | internal | ✅ Found |
| cic-ingest-world | internal | ✅ Found |
| cic-repair-pipeline | internal | ✅ Found |
| cic-run-gate | internal | ✅ Found |

### cic-repair-pipeline

| Dependency | Type | Status |
|------------|------|--------|
| _cic-shared | internal | ✅ Found |

### cic-roadmap-updater

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### cic-run-gate

| Dependency | Type | Status |
|------------|------|--------|
| _cic-shared | internal | ✅ Found |

### cic-section-summarizer

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### context-manager

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### hook-validator

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

### parallel-search

| Dependency | Type | Status |
|------------|------|--------|
| parallel-web | external | ❌ Missing |

### permission-governor

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### plan-extractor-integration

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### pre-flight-test-checker

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

### research-questions

| Dependency | Type | Status |
|------------|------|--------|
| scan-gaps.mjs | external | ❌ Missing |
| update-focus-areas.mjs | external | ❌ Missing |

### retro-export

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### retro-schema-validator

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

### tinyfish-search

| Dependency | Type | Status |
|------------|------|--------|
| @tiny-fish/sdk | external | ❌ Missing |

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

### trm-closed-loop-research

| Dependency | Type | Status |
|------------|------|--------|
| git | external | ❌ Missing |
| node | external | ❌ Missing |
| pwsh | external | ❌ Missing |

### trm-devops-triage

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### trm-feedback-report

| Dependency | Type | Status |
|------------|------|--------|
| trm | external | ❌ Missing |
| trm-status | internal | ✅ Found |

### trm-status

| Dependency | Type | Status |
|------------|------|--------|
| git | external | ❌ Missing |

### wiki-sync-recovery

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### work-summarizer

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### workspace-storage-cleaner

| Dependency | Type | Status |
|------------|------|--------|
| python3 | external | ❌ Missing |

### writing-heuristics

| Dependency | Type | Status |
|------------|------|--------|
| *(none)* | — | Leaf node |

### Inbound Dependencies (What Depends on Each Skill)

### _cic-shared

| Dependent | Type |
|-----------|------|
| cic-consolidate-artifacts | internal |
| cic-ingest-world | internal |
| cic-orchestrate-flow | internal |
| cic-repair-pipeline | internal |
| cic-run-gate | internal |

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

| Dependent | Type |
|-----------|------|
| cic-orchestrate-flow | internal |

### cic-ingest-world

| Dependent | Type |
|-----------|------|
| cic-orchestrate-flow | internal |

### cic-orchestrate-flow

No inbound dependencies (root skill)\n
### cic-repair-pipeline

| Dependent | Type |
|-----------|------|
| cic-orchestrate-flow | internal |

### cic-roadmap-updater

No inbound dependencies (root skill)\n
### cic-run-gate

| Dependent | Type |
|-----------|------|
| cic-orchestrate-flow | internal |

### cic-section-summarizer

No inbound dependencies (root skill)\n
### context-manager

No inbound dependencies (root skill)\n
### hook-validator

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
### parallel-search

No inbound dependencies (root skill)\n
### permission-governor

No inbound dependencies (root skill)\n
### plan-extractor-integration

No inbound dependencies (root skill)\n
### pre-flight-test-checker

No inbound dependencies (root skill)\n
### pre-wrap-audit

No inbound dependencies (root skill)\n
### reconcile-vector-store

No inbound dependencies (root skill)\n
### research-questions

No inbound dependencies (root skill)\n
### retro-export

No inbound dependencies (root skill)\n
### retro-schema-validator

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
### tinyfish-search

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

### trm-closed-loop-research

No inbound dependencies (root skill)\n
### trm-devops-triage

No inbound dependencies (root skill)\n
### trm-feedback-report

No inbound dependencies (root skill)\n
### trm-status

| Dependent | Type |
|-----------|------|
| trm-feedback-report | internal |

### wiki-sync-recovery

No inbound dependencies (root skill)\n
### work-summarizer

No inbound dependencies (root skill)\n
### workspace-storage-cleaner

No inbound dependencies (root skill)\n
### writing-heuristics

No inbound dependencies (root skill)\n
---

## Dependency Depth (Leaf → Root)

Depth 0 = Leaf node (no dependencies)
Depth N = Depends on at least one skill at depth N-1

| Skill | Depth |
|-------|-------|| cic-orchestrate-flow | 2 |
| trm-feedback-report | 2 |
| cic-consolidate-artifacts | 1 |
| cic-ingest-world | 1 |
| cic-repair-pipeline | 1 |
| cic-run-gate | 1 |
| parallel-search | 1 |
| pre-wrap-audit | 1 |
| research-questions | 1 |
| skill-security-auditor | 1 |
| tinyfish-search | 1 |
| toolforge-cli | 1 |
| trm-closed-loop-research | 1 |
| trm-status | 1 |
| workspace-storage-cleaner | 1 |
| _cic-shared | 0 |
| agent-drift-detector | 0 |
| analyze-token-burn | 0 |
| ashfall | 0 |
| automation-audit | 0 |
| cic-roadmap-updater | 0 |
| cic-section-summarizer | 0 |
| context-manager | 0 |
| hook-validator | 0 |
| html-visual-verify | 0 |
| kb-sync-artifact-generator | 0 |
| kb-sync-nightly | 0 |
| obsidian-ingest-wiki | 0 |
| operator-image-build | 0 |
| permission-governor | 0 |
| plan-extractor-integration | 0 |
| pre-flight-test-checker | 0 |
| reconcile-vector-store | 0 |
| retro-export | 0 |
| retro-schema-validator | 0 |
| rewrite-labs-orchestrator | 0 |
| roadmap-validator | 0 |
| rollback-phase | 0 |
| run-adapter-diagnostic | 0 |
| scale-ingestion-service | 0 |
| session-wrap | 0 |
| skill-health-monitor | 0 |
| tool-lifecycle-manager | 0 |
| toolforge-drift-monitor | 0 |
| toolforge-registry-manager | 0 |
| toolforge-submission-validator | 0 |
| trm-devops-triage | 0 |
| wiki-sync-recovery | 0 |
| work-summarizer | 0 |
| writing-heuristics | 0 |

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
| agent-drift-detector |
| analyze-token-burn |
| automation-audit |
| cic-orchestrate-flow |
| cic-roadmap-updater |
| cic-section-summarizer |
| context-manager |
| hook-validator |
| html-visual-verify |
| kb-sync-artifact-generator |
| kb-sync-nightly |
| obsidian-ingest-wiki |
| operator-image-build |
| parallel-search |
| permission-governor |
| plan-extractor-integration |
| pre-flight-test-checker |
| pre-wrap-audit |
| reconcile-vector-store |
| research-questions |
| retro-export |
| retro-schema-validator |
| rewrite-labs-orchestrator |
| roadmap-validator |
| rollback-phase |
| run-adapter-diagnostic |
| scale-ingestion-service |
| session-wrap |
| skill-health-monitor |
| skill-security-auditor |
| tinyfish-search |
| tool-lifecycle-manager |
| toolforge-cli |
| toolforge-drift-monitor |
| trm-closed-loop-research |
| trm-devops-triage |
| trm-feedback-report |
| wiki-sync-recovery |
| work-summarizer |
| workspace-storage-cleaner |
| writing-heuristics |

---

## Health Summary

| Category | Status | Details |
|----------|--------|---------|
| Cycles | ✅ PASS | 0 cycle(s) detected |
| Missing Deps | ✅ PASS | 0 missing dep(s) |
| Orphans | ⚠️ WARN | 41 orphan skill(s) |

---

**Report generated by 	oolforgeDependencyGraph.ps1 — Phase 1.4**


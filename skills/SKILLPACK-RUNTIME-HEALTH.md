# Toolforge Skill Runtime Health Report

**Generated:** 2026-07-08T09:20:40.1738735Z

**Phase:** 1.6 — Runtime Health Check Implementation

---

## Summary

| Check Type | Passed | Warned | Failed | Total |
|------------|--------|--------|--------|-------|
| **Totals** | 41 | 30 | 7 | 78 |
| % Pass | 52.6% | 38.5% | 9% | 100% |

---

## Skills Health Status

### analyze-token-burn — ❌ ERROR

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ❌ FAIL | File not found: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ⚠️ WARN | No exports detected in entrypoint |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### ashfall — ❌ ERROR

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ❌ FAIL | No entrypoint specified |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ⚠️ WARN | No exports detected in entrypoint |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### kb-sync-nightly — ⚠️ WARN

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ✅ PASS | Valid: src/run.sh |
| Runtime | ✅ PASS | Found: bash |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ✅ PASS | Runtime bash (dry-run not applicable) |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### operator-image-build — ⚠️ WARN

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ✅ PASS | Valid: dist/index.js |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ✅ PASS | Syntax valid |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### pre-wrap-audit — ❌ ERROR

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ❌ FAIL | No entrypoint specified |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | All 1 internal deps available |
| DryRun | ⚠️ WARN | No exports detected in entrypoint |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### reconcile-vector-store — ❌ ERROR

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ❌ FAIL | File not found: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ⚠️ WARN | No exports detected in entrypoint |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### roadmap-validator — ⚠️ WARN

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ✅ PASS | Valid: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ✅ PASS | Syntax valid |
| Manifest | ✅ PASS | Consistent |
| AuditLog | ⚠️ WARN | No audit log found |

### rollback-phase — ❌ ERROR

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ❌ FAIL | File not found: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ⚠️ WARN | No exports detected in entrypoint |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### run-adapter-diagnostic — ❌ ERROR

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ❌ FAIL | File not found: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ⚠️ WARN | No exports detected in entrypoint |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### scale-ingestion-service — ❌ ERROR

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ❌ FAIL | File not found: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ⚠️ WARN | No exports detected in entrypoint |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

### tool-lifecycle-manager — ⚠️ WARN

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ✅ PASS | Valid: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ✅ PASS | Syntax valid |
| Manifest | ✅ PASS | Consistent |
| AuditLog | ⚠️ WARN | No audit log found |

### toolforge-drift-monitor — ⚠️ WARN

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ✅ PASS | Valid: src/index.ts |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ✅ PASS | Syntax valid |
| Manifest | ✅ PASS | Consistent |
| AuditLog | ⚠️ WARN | No audit log found |

### work-summarizer — ⚠️ WARN

| Check | Result | Details |
|-------|--------|---------|
| Entrypoint | ✅ PASS | Valid: dist/index.js |
| Runtime | ✅ PASS | Found: npm |
| Dependencies | ✅ PASS | No dependencies |
| DryRun | ✅ PASS | Syntax valid |
| Manifest | ⚠️ WARN | No entry in manifest |
| AuditLog | ⚠️ WARN | No audit log found |

---

## Health Categories

### ✅ Good Health

Skills passing all checks:
*(none)*\n
### ⚠️ Warning Health

Skills with warnings but no failures:
- kb-sync-nightly
- operator-image-build
- roadmap-validator
- tool-lifecycle-manager
- toolforge-drift-monitor
- work-summarizer

### ❌ Error Health

Skills with critical failures:
- analyze-token-burn
- ashfall
- pre-wrap-audit
- reconcile-vector-store
- rollback-phase
- run-adapter-diagnostic
- scale-ingestion-service

---

**Report generated by 	oolforgeSkillHealthCheck.ps1 — Phase 1.6**


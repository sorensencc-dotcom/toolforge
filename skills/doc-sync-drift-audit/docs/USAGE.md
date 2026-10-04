# Doc-Sync Drift Audit Usage Guide

This guide details workflow execution, cache diagnostics, and receipt remediation for the `doc-sync-drift-audit` skill.

---

## 1. Typical Workflows

### Pre-Release Documentation Audit
Run before tagging a release or merging large doc changes to ensure all cross-vault links and sidebars resolve cleanly:

```bash
claude -p "check doc sync for drift"
```

Expected behavior:
1. Loads the unified doc-sync registry (`config/doc-sync.json`).
2. Validates cache schema compatibility.
3. Recursively verifies sidebar manifests against physical target files.
4. Emits a timestamped receipt in `drift receipts/doc-sync-receipt-YYYYMMDD.json`.

---

## 2. Handling Drift Scenarios

### Scenario A: Cache Schema Refusal (`DOC_SYNC_CACHE_REFUSED`)
**Symptom**: Output reports `status: "CACHE_REFUSED"` with schema mismatch (e.g., expected `2.1.0`, found `2.0.0`).

**Resolution**:
1. Run the cache invalidation task:
   ```bash
   npm run doc-sync:cache:clean
   ```
2. Re-run `doc-sync-drift-audit` to generate a fresh index.

### Scenario B: Broken Sidebar References (`DOC_SYNC_BROKEN_SIDEBAR`)
**Symptom**: Output flags broken cross-product targets in `brokenLinks`.

**Resolution**:
1. Open the identified sidebar definition file cited in `sourceFile`.
2. Update the target reference path or add the missing documentation stub.
3. Re-verify with `doc-sync-drift-audit`.

---

## 3. Drift Receipt Format

When `persistReceipt: true`, the audit generates a machine-readable JSON artifact:

```json
{
  "$schema": "https://toolforge.dev/schemas/doc-sync-receipt.v1.json",
  "auditId": "audit-20261004-182500",
  "timestamp": "2026-10-04T18:25:00.000Z",
  "status": "PASS",
  "summary": {
    "totalPagesScanned": 142,
    "stalePagesCount": 0,
    "brokenLinksCount": 0
  },
  "cache": {
    "version": "2.1.0",
    "accepted": true
  }
}
```

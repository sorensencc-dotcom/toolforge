# Governance Matrix Validator Usage Guide

This guide details workflow execution, matrix failure unmasking, and cross-repo triage for the `governance-matrix-validator` skill.

---

## 1. Typical Workflows

### Audit CI Governance Matrix Workflow
Run when CI workflows are updated or when diagnosing mysteriously green matrix jobs:

```bash
claude -p "validate governance gates"
```

Expected behavior:
1. Parses `.github/workflows/ci-governance-matrix.yml`.
2. Flags all occurrences of `continue-on-error: true` that mask step exit codes.
3. Cross-checks step execution targets against sibling repo checkouts:
   - `cic-ingestion`: Checks for `gov:validate` in root `package.json`.
   - `toolforge`: Verifies plugin paths (e.g., `toolforge-pdf-ingestion`).
   - `sigil`: Validates hoisted dependencies (e.g., `@cic/delivery-guard`).
4. Generates an action matrix sorted by severity.

---

## 2. Cross-Repo Failure Triage

### Case 1: Missing Script in Sibling Repo (`cic-ingestion#2`)
**Symptom**: CI matrix invokes `npm run gov:validate` in `cic-ingestion`, but the script is absent from its `package.json`.

**Resolution**:
1. Add the missing `gov:validate` script entry in `c:/dev/cic-ingestion/package.json`.
2. Ensure local execution passes before re-running matrix verification.

### Case 2: Broken Plugin Path (`toolforge#69`)
**Symptom**: Workflow references `toolforge-pdf-ingestion` plugin path which does not resolve on disk.

**Resolution**:
1. Update plugin path reference in tool configuration or restore relocated module.
2. Re-run validator to verify resolution.

### Case 3: Missing Hoisted Dependency (`sigil#15`)
**Symptom**: `@cic/delivery-guard` declared in workspace consumer but missing in hoisted node_modules.

**Resolution**:
1. Re-run monorepo bootstrap/install to sync hoisted lockfile.
2. Re-validate governance gates.

---

## 3. Output Report Example

```json
{
  "status": "ACTION_REQUIRED",
  "maskedFailures": [
    {
      "jobName": "gov-matrix-verify",
      "stepName": "Run cic-ingestion gate",
      "reason": "continue-on-error: true set on step"
    }
  ],
  "repoFindings": [
    {
      "repo": "cic-ingestion",
      "issueCode": "MISSING_GOV_VALIDATE_SCRIPT",
      "severity": "CRITICAL",
      "missingTarget": "package.json -> scripts.gov:validate",
      "suggestedFix": "Add 'gov:validate': 'node ./scripts/gov-check.mjs' to package.json"
    }
  ],
  "recommendedActions": [
    "Fix missing gov:validate script in cic-ingestion",
    "Remove continue-on-error flag from ci-governance-matrix.yml"
  ],
  "timestamp": "2026-10-04T18:30:00.000Z"
}
```

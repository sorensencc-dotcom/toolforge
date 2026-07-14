---
title: Deliverable 4 — Submission Validator
phase: Phase 8 Wave D
owner: Tier 2 (Implementation)
status: READY FOR EXECUTION
---

# Deliverable 4 — Submission Validator

## Objective
Implement submission validator: 5-check conformance gate (manifest, tests, docs, governance, caveman). Output: structured report (JSON) + human-readable summary.

## Action

### 4.1 Create Validator Entry Point
**Output:** `skills/toolforge-submission-validator/src/validate.ts` (TypeScript)

Main function: `validateSubmission(skillPath: string): ConformanceReport`

Runs all 5 checks sequentially, collects results, generates report.

### 4.2 Check 1: Manifest Validation
**Function:** `checkManifestValid(skillPath: string): CheckResult`

**Action:**
1. Load `SKILL.json` from skill directory
2. Validate against schema (Deliverable 1)
3. Check required fields: id, name, version, description, entrypoint, runtime, owner, category, status
4. Verify version is semver
5. Verify category is from allowed list
6. Verify runtime is known

**Output:**
```json
{
  "check": "manifest_valid",
  "passed": true,
  "errors": [],
  "warnings": []
}
```

### 4.3 Check 2: Tests Pass
**Function:** `checkTestsPass(skillPath: string): CheckResult`

**Action:**
1. Check if tests exist (look for `tests/`, `*.test.ts`, `*.test.ps1`)
2. Run test harness:
   - TypeScript: `npm test` (from skill directory)
   - PowerShell: `Invoke-Pester tests/`
   - Node: `npm test`
3. Capture exit code + output
4. Check coverage > 70% (if available)
5. Fail if any tests skipped (all must run)

**Output:**
```json
{
  "check": "tests_pass",
  "passed": true,
  "coverage": 75,
  "errors": [],
  "warnings": ["1 test skipped (expected 0)"]
}
```

### 4.4 Check 3: Documentation Complete
**Function:** `checkDocsComplete(skillPath: string): CheckResult`

**Action:**
1. Check for README.md OR docs/README.md
2. Verify sections present:
   - Purpose (what does skill do)
   - Usage (how to use it)
   - Inputs/Outputs (what does it consume/produce)
   - Permissions (what does it need)
3. Verify no broken [[wiki-links]]
4. Verify code examples format correctly

**Output:**
```json
{
  "check": "docs_complete",
  "passed": true,
  "errors": [],
  "warnings": ["No code examples found"]
}
```

### 4.5 Check 4: Governance Aligned
**Function:** `checkGovernanceAligned(skillPath: string): CheckResult`

**Action:**
1. **Duplication check:** Grep codebase for similar files. Flag if >70% similarity with existing skill
2. **Naming check:** Verify skill ID follows pattern `<scope>-<function>` (lowercase, hyphens)
3. **Owner check:** Verify owner is registered in CLAUDE.md
4. **Category check:** Flag if 3+ skills in same category (avoid duplication)
5. **Permissions check:** Verify permissions match scope (e.g., "monitoring" shouldn't need network.write)
6. **Safety check:** No `eval`, `exec`, or dynamic code execution

**Output:**
```json
{
  "check": "governance_aligned",
  "passed": false,
  "errors": [
    "Naming violation: expected 'toolforge-xyz', got 'mytool'"
  ],
  "warnings": [
    "3 similar skills in 'monitoring' category (consider consolidation)"
  ]
}
```

### 4.6 Check 5: Caveman Review
**Function:** `checkCavemanReview(skillPath: string): CheckResult`

**Action:**
1. Set status to "pending" (manual review required)
2. Generate caveman review checklist (style, scope, structure)
3. Output block reason: "awaiting Tier 1 manual review"

**Output:**
```json
{
  "check": "caveman_review",
  "passed": false,
  "status": "pending",
  "errors": ["Caveman review required (manual Tier 1 step)"],
  "warnings": []
}
```

### 4.7 Conformance Report
**Function:** `generateConformanceReport(skillPath: string): ConformanceReport`

Combines all 5 checks into single report:

```json
{
  "submission_id": "sub-uuid-xxx",
  "skill_id": "toolforge-drift-monitor",
  "skill_version": "0.1.0",
  "timestamp": "2026-07-13T12:00:00Z",
  "status": "pending_approval",
  "checks": {
    "manifest_valid": { "passed": true, "errors": [], "warnings": [] },
    "tests_pass": { "passed": true, "coverage": 75, "errors": [], "warnings": [] },
    "docs_complete": { "passed": true, "errors": [], "warnings": [] },
    "governance_aligned": { "passed": true, "errors": [], "warnings": [] },
    "caveman_review": { "passed": false, "status": "pending", "errors": [], "warnings": [] }
  },
  "blockers": ["Caveman review pending"],
  "warnings": [],
  "recommendation": "HOLD FOR CAVEMAN REVIEW",
  "pr_url": null,
  "caveman_reviewer": null
}
```

### 4.8 Report Output
**Output:** `<skill-dir>/CONFORMANCE-REPORT.json` + stdout (human-readable)

Human format:
```
Conformance Report for toolforge-drift-monitor (v0.1.0)
Generated: 2026-07-13T12:00:00Z
Submission ID: sub-uuid-xxx

✓ manifest_valid
✓ tests_pass (coverage: 75%)
✓ docs_complete
✓ governance_aligned
◐ caveman_review (pending)

Blockers: Caveman review pending
Warnings: none

Recommendation: HOLD FOR CAVEMAN REVIEW
Next: Await Tier 1 approval at https://github.com/soren/c--dev/pull/123
```

## Invariants
- **No code execution:** Validator only reads/analyzes (no eval, exec)
- **Determinism:** Same skill → same report every time
- **Schema validation:** All checks produce CheckResult objects
- **Blocking logic:** All blockers prevent publication (Tier 1 must approve)
- **Audit trail:** Report saved to disk + git

## Success Criteria
- ✓ Validator entry point created + runs without error
- ✓ Manifest validator detects missing fields + invalid types
- ✓ Test validator runs tests + captures coverage
- ✓ Doc validator detects missing sections + broken links
- ✓ Governance validator detects duplication + naming violations
- ✓ Caveman review blocker set (requires manual Tier 1 review)
- ✓ Conformance report generated (JSON + human-readable)
- ✓ All 5 checks produce correct results on sample skills
- ✓ Zero code execution (no eval, exec, or dynamic code)

## Test Strategy
```typescript
// Test 1: Valid manifest passes check
const skill = "skills/toolforge-drift-monitor";
const report = validateSubmission(skill);
expect(report.checks.manifest_valid.passed).toBe(true);

// Test 2: Missing README fails doc check
// (mock missing README)
expect(report.checks.docs_complete.passed).toBe(false);
expect(report.checks.docs_complete.errors).toContain("README not found");

// Test 3: Failed tests fail check
// (mock test failure)
expect(report.checks.tests_pass.passed).toBe(false);
expect(report.checks.tests_pass.errors.length).toBeGreaterThan(0);

// Test 4: Caveman review always pending (manual step)
expect(report.checks.caveman_review.status).toBe("pending");

// Test 5: Blockers list accurate
expect(report.blockers).toContain("Caveman review pending");

// Test 6: Report JSON valid
const json = JSON.stringify(report);
expect(() => JSON.parse(json)).not.toThrow();

// Test 7: No code execution
// (validate no eval/exec calls in source)
```

## Exit Criteria (Binary)
- [ ] Validator entry point created + executable
- [ ] Manifest validator works + detects schema violations
- [ ] Test validator runs + captures coverage
- [ ] Doc validator detects missing README + broken links
- [ ] Governance validator detects duplication + naming issues
- [ ] Caveman review check always pending (manual step)
- [ ] Conformance report generated (JSON + human)
- [ ] All checks produce correct results on 2+ test skills
- [ ] Zero code execution (no unsafe operations)
- [ ] Documentation added to `docs/toolforge/VALIDATOR.md`

---

## Related
- Deliverable 1: Manifest Schema (validator enforces this)
- Deliverable 2: Registry Service (validator populates registry on approval)
- Deliverable 3: CLI (cli calls validator for `toolforge submit`)

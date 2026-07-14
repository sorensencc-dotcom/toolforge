# Toolforge Marketplace v1.0 Integration Test

**Scope:** All 4 deliverables (Manifest Schema, Registry Service, CLI, Submission Validator) in single flow.

**Test Date:** 2026-07-14

## Scenario 1: Valid Skill Submission → Registry → Install

### Setup
- Create test skill with valid SKILL.json, README, tests
- Verify manifest validates against schema
- Submit skill via CLI
- Validator confirms conformance
- Registry accepts submission
- User installs via CLI

### Steps

1. **Manifest Validation**
   - Load test skill SKILL.json
   - Validate against docs/toolforge/schemas/skill.marketplace.schema.json
   - Expected: PASS (all required fields, valid patterns)

2. **Submission Validator**
   - Run validateSubmission(testSkillPath)
   - Checks:
     - manifest_valid: ✓
     - tests_pass: ✓ (test dir exists)
     - docs_complete: ✓ (README with sections)
     - governance_aligned: ✓ (naming, owner, no unsafe code)
     - caveman_review: pending
   - Expected: recommendation = "approve"

3. **Registry Operations**
   - Add-PluginToRegistry -PluginIdArg "test-skill" -PathArg "/path" -ChecksumArg "sha256-abc123"
   - Verify plugin entry in registry.json plugins array
   - Verify metadata counts updated (total_plugins incremented)
   - Verify audit log entry created

4. **CLI List**
   - toolforge list --status published
   - Expected: test-skill appears in output
   - Verify table format (ID, Name, Version, Category, Status, Published)

5. **CLI Install** (if published)
   - toolforge install test-skill
   - Expected: copied to ~/.toolforge/skills/test-skill
   - Verify checksum matches registry entry

### Expected Outcome
- ✓ Manifest valid
- ✓ Validator recommends "approve"
- ✓ Plugin in registry with status "published"
- ✓ CLI list shows plugin
- ✓ CLI install succeeds with checksum match

---

## Scenario 2: Invalid Skill Rejection

### Setup
- Create skill with invalid SKILL.json (missing required fields)
- Submit via CLI
- Validator rejects

### Steps

1. **Manifest Validation**
   - Load invalid SKILL.json (missing "owner")
   - Validate against schema
   - Expected: FAIL (required field missing)

2. **Submission Validator**
   - Run validateSubmission(invalidSkillPath)
   - Checks:
     - manifest_valid: ✗
     - others: pending
   - Expected: recommendation = "reject", blockers include "Missing or invalid 'owner' field"

3. **Registry Rejection**
   - Attempt Add-PluginToRegistry fails (blockers present)
   - Plugin NOT added to registry.json
   - No audit entry created

### Expected Outcome
- ✗ Manifest invalid
- ✗ Validator recommends "reject"
- ✗ Registry rejects submission
- Submission record created with rejection status

---

## Scenario 3: Incomplete Documentation

### Setup
- Create skill with valid manifest, tests, but missing documentation
- Submit via CLI
- Validator holds pending docs

### Steps

1. **Docs Check**
   - No README.md found
   - docs_complete: ✗

2. **Validator Recommendation**
   - Expected: recommendation = "hold"
   - Blockers: "Documentation incomplete (missing README or required sections)"
   - caveman_review: pending (not auto-approved)

3. **Registry Hold**
   - Plugin stored with submission_status = "pending"
   - Marked for manual review (caveman gate)
   - Can be rejected or published after Tier 1 approval

### Expected Outcome
- ✗ Docs incomplete
- ◐ Validator holds (recommendation = "hold")
- ◐ Registry entry pending (not published)
- Awaits Tier 1 approval

---

## Scenario 4: Registry Append-Only Semantics

### Setup
- Add plugin to registry
- Attempt to re-add same plugin ID
- Update plugin status

### Steps

1. **Duplicate Prevention**
   - Add-PluginToRegistry "test-skill" first time: ✓
   - Add-PluginToRegistry "test-skill" second time: ✗ (exit code 1)
   - Expected: "Plugin ID already exists in registry"

2. **Status Update (Non-Rewriting)**
   - Mark-PluginQuarantined "test-skill" "unsafe code detected"
   - Verify: original plugin entry unchanged, status field updated
   - Verify: audit log entry created (not plugin rewrite)
   - Expected: plugins array unchanged, audit.log appended

3. **Metadata Recalc**
   - Update-RegistryMetadata
   - Recount published, pending, quarantined counts
   - Verify metadata.quarantined_count incremented

### Expected Outcome
- ✓ Duplicate rejected
- ✓ Status update appends to audit log only
- ✓ Metadata reflects all statuses

---

## Success Criteria

All scenarios pass:
- ✓ Manifest schema enforces required fields and patterns
- ✓ Submission validator all 5 checks operational
- ✓ Registry append-only semantics working
- ✓ CLI commands (list, install, submit) functional
- ✓ End-to-end flow: submit → validate → approve/reject → registry → install
- ✓ All 4 deliverables integrated and passing

**Gate:** Ready for Phase 8 gate verification (2026-07-26)

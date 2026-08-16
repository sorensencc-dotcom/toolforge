---
name: workflow-checklists-embedded
description: "Pre-action checklists embedded in agent workflow to prevent drift incidents. Use before Artifact, Write, and governance tasks."
metadata: 
  node_type: memory
  type: feedback
  severity: critical
  status: active
  deployedDate: 2026-07-12
  originSessionId: 146a440d-b5c6-4651-b2a2-05a61fdbb397
---

# Embedded Workflow Checklists

**Rule: Run checklist BEFORE critical action. No exceptions.**

Prevents: retroactive approvals, unapproved publications, wrong directories, design non-compliance.

---

## Pre-Artifact Checklist

**Trigger**: Before calling Artifact tool to publish anything.

**Checklist**:

```
[ ] 1. What is this? (artifact type: governance, design, proposal, guide, etc.)
[ ] 2. Classification: Class 1 / 2 / 3? (1=foundational, 3=creative)
[ ] 3. Approval needed? Class 1/3 → Tier 1? Class 2 → none?
[ ] 4. Is approval already received? (Check memory, ask user if unsure)
[ ] 5. If no approval: STOP. Do not publish. Flag for Tier 1 gate.
[ ] 6. Design system compliance: CIC? standard? plain? Verified?
[ ] 7. Storage correct: Artifact tool (claude.ai)? Committed to repo? Memory?
[ ] 8. Ready to publish? All checks pass → proceed
```

**If ANY check fails: STOP. Do not call Artifact. Flag for user.**

**Example**: Creating handoff doc
- Type: operational guidance
- Class: 3 (creative)
- Approval: needs Tier 1
- Status: not approved yet
- Action: **STOP**. Create draft, ask user for Tier 1 gate.

---

## Pre-Write Checklist

**Trigger**: Before calling Write tool for files, memory, or config.

**Checklist**:

```
[ ] 1. What type of file? (governance, drift incident, session note, code, config, etc.)
[ ] 2. Where should it live? (memory/ vs repo vs CLAUDE.md?)
[ ] 3. Verify path against Global Operating Rules:
       - Governance → CLAUDE.md or memory/
       - Drift incidents → memory/ (NOT docs/meta/)
       - Session notes → memory/
       - Code → repo
       - Config → repo
[ ] 4. Path correct? (e.g., C:\Users\soren\.claude\projects\c--dev\memory\*.md)
[ ] 5. Confirm destination before Write
```

**If destination unclear: STOP. Ask user or verify in Global Operating Rules.**

**Example**: Creating drift incident record
- Type: drift incident
- Home: memory/
- Path: C:\Users\soren\.claude\projects\c--dev\memory\drift-*.md
- Action: ✅ Proceed with Write to correct path

---

## Pre-Governance Checklist

**Trigger**: Before writing any governance rule, policy, or architectural decision.

**Checklist**:

```
[ ] 1. Does this document claim a mechanism/process exists?
[ ] 2. If yes: Can I point to the code/config that implements it?
[ ] 3. Is the mechanism ACTUALLY deployed? (Not planned, not assumed)
[ ] 4. Can I verify with grep / file read / architecture map?
[ ] 5. If mechanism doesn't exist: Document as "planned for" or rewrite claim
[ ] 6. No statements like "will automatically" or "must" without evidence
[ ] 7. Ready to publish? Mechanism verified → proceed
```

**If mechanism unverified: STOP. Research first, then write.**

**Example**: Claim "Skills auto-install to toolforge on merge"
- Claim: true for toolforge-registered skills only
- Evidence: manifest.json + kb-sync distinction
- Mechanism: manifest validation on merge → toolforge discovery
- Status: ✅ Verified (for registered skills)
- Fix: Add "registered in manifest.json" to claim

---

## How to Use

### Before Artifact Call

```python
# BEFORE: artifact_tool.call(...)
check_artifact_preconditions()  # Run checklist
if not all_checks_pass:
    flag_for_tier1_approval()
    return
publish_artifact()
```

### Before Write Call

```python
# BEFORE: write_tool(file_path, content)
verify_storage_location(file_path)  # Run checklist
if destination_wrong:
    ask_user_or_verify_rules()
    return
write_file(file_path, content)
```

### Before Governance Draft

```python
# BEFORE: write governance document
verify_mechanisms_exist()  # Run checklist
if mechanisms_unverified:
    research_architecture()
    return
write_governance()
```

---

## Checklist States

- **✅ PASS**: All items checked, ready to proceed
- **⚠️ CLARIFY**: Item unclear, ask user before proceeding
- **❌ STOP**: Item failed, do not proceed without fix or explicit override

---

## Integration Points

### Slack Notification (Optional)

Post to #cic-dev for Class 1 artifacts:

```
📋 Pre-Publish Checklist: [artifact name]
- Classification: Class 1 ✓
- Approval: Pending Tier 1 (2026-07-15 gate)
- Status: HALTED until approval

Ready to republish after: [approval date]
```

### Memory Log

Each checklist completion logged to memory:

```markdown
**Checklist Run**: [date/time]
- Artifact: [name]
- Checks: 8/8 PASS ✓
- Action: Published
- Reference: Commit [hash]
```

---

## Exceptions & Overrides

**When to skip checklist: NEVER.**

**When to override a check: Only with explicit user instruction.**

**When user says "publish without approval":**
1. Confirm: "Publish [name] without Tier 1? (Drift risk)"
2. Document: Create drift incident record if not approved
3. Proceed: Only after user re-confirms

---

## Weekly Audit

**Every Friday**: Spot-check 5 published artifacts
- Did pre-publish checklist run?
- Were all checks documented?
- Any skipped checks?
- Log findings to memory

---

## Deployment

**Active immediately (2026-07-12)**.

Checklist runs BEFORE every Artifact, Write, or governance call. No exceptions.

Prevents: DRIFT-001, 002, 003, 004, CIC Exception (100% coverage)

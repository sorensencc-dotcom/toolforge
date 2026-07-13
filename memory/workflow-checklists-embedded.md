---
name: workflow-checklists-embedded
description: Pre-action checklists embedded in CLAUDE.md to prevent drift incidents
metadata:
  type: reference
---

# Embedded Workflow Checklists

Active immediately (2026-07-12). Run checklist BEFORE critical action.

## Pre-Artifact Checklist (Before Publishing)

- [ ] Classification: Class 1/2/3?
- [ ] Approval needed: Tier 1?
- [ ] Approved? (not assumption — verify)
- [ ] Design system compliance: CIC/standard/plain?
- [ ] Storage: Artifact tool (claude.ai)?

**If any check fails: STOP. Do not publish without fix or explicit override.**

## Pre-Write Checklist (Before Creating Files)

- [ ] File type: governance / drift / session note / code / config?
- [ ] Correct location: CLAUDE.md / memory/ / repo / other?
- [ ] Verified against Global Operating Rules?

## Pre-Governance Checklist (Before Writing Rules)

- [ ] Does this claim mechanisms exist?
- [ ] Can I point to code/config that proves it?
- [ ] No "automatic" claims without verification?

**Prevents**: Unauthorized artifacts, design non-compliance, wrong storage, false governance claims.

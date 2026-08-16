---
name: aab-governance-decisions
description: "AAB (CIC Governance Layer Expansion) — operator decisions on integration points, policy contributors, LLM strategy, re-audit frequency"
metadata: 
  node_type: memory
  type: project
  originSessionId: eedeeff0-96f2-4f17-9c9a-0838b535b660
---

## AAB Governance Decisions (2026-06-07)

### 1. Approval Infrastructure Integration
**Decision:** Integrate overrides with existing approval records.

**Why:** CIC's approval infrastructure already tracks operator decisions; governance overrides should follow the same pattern for auditability.

**How to apply:**
- Store in `override_decision` alongside: `approver_id`, `reason`, `expiry`, `linked_approval_record_id`
- Query approval system to resolve: "who let X through and why"
- Use existing approval records as source of truth for override lineage
- Implement interface: `async requestOverride(auditResult, approver, reason, linkedApprovalId?)` in GovernanceGate

**Related:** [[approval-infrastructure-location]] (fetch CIC approval records storage location if not already in memory)

---

### 2. Policy Contributors
**Decision:** CIC maintainers only; no community contributions initially.

**Why:** Community policies complicate trust, versioning enforcement, and require additional review burden. Safer to launch locked, add proposal mechanism later.

**How to apply:**
- Store policies in `/cic/src/governance/policies/index.ts` as curated SkillPolicies array
- No user-facing policy submission endpoint
- Future: Add `policies_proposals/` directory with review workflow (not in Phase 1)
- Policy changes require code review + merge to main

---

### 3. LLM Model for Semantic Audit
**Decision:** Operator-configurable with default profiles; deterministic stage always local.

**Why:** Deterministic is fast and certain; semantic audit must be tunable for cost (haiku) vs rigor (opus) by environment/tier.

**How to apply:**
- Deterministic stage: always local (no LLM)
- Semantic stage: configurable via `semantic_audit_profile` config
  - Default profiles: `{ fast: "claude-haiku-4-5", strict: "claude-opus-4-8" }`
  - Selection logic: tie to `user_tier` or environment (dev/staging/prod)
  - Example: external users in prod → force opus; internal in dev → allow haiku
- Store config in `SkillAudit` constructor or `.env`
- Example: `SEMANTIC_AUDIT_MODEL_EXTERNAL=opus` `SEMANTIC_AUDIT_MODEL_INTERNAL=haiku`

---

### 4. Mandatory Re-audit Frequency
**Decision:** 90 days default; configurable per policy severity.

**Why:** High-severity skills drift faster; low-risk skills stable longer. Encode in policy metadata for automatic scheduling.

**How to apply:**
- Add to GovernancePolicy: `reaudit_interval_days: 30 | 60 | 90 | 180`
  - `high` severity → 30–60 days
  - `medium` → 90 days
  - `low` → 180 days
- Calculate `next_mandatory_audit_at` in SkillGovernanceRecord: `now + min(reaudit_intervals for all triggered policies)`
- CronCreate job polls `next_mandatory_audit_at` table, triggers re-audits batch nightly
- Entry point: `async scheduleReaudits()` in SkillMonitor

---

### 5. Phase 1 Ready
**Status:** READY FOR IMPLEMENTATION

Phase 1 scope (deterministic + cache + lineage basics) is locked in. No further design decisions needed. Proceed with concrete task list.

---

## Implementation Strategy
- **Deterministic first:** Build audit engine on static checks (regex, AST), hard FAIL on matches
- **Cache layer:** Redis keyed by `skill_id:version:policy_version`
- **Lineage append-only:** Database schema for immutable audit log
- **Context:** Expand GovernanceContext with `user_tier`, `intended_scope`, `permissions`, `task_context`
- **No LLM in Phase 1:** Semantic audit deferred to Phase 2

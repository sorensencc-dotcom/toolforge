---
name: skill-approval-governance
description: "Tier 0 auto-install for skills, Tier 1 approval only for major features (architecture/security/breaking changes)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9837535e-c768-4223-a214-59099185e3e1
---

## Rule: Skill Approval & Toolforge Installation

**Tier 0 (Auto-Install)**: Skills, scripts, docs, observability
- No Tier 1 approval needed
- Auto-installs to toolforge library on merge to main
- Requirement: caveman review (no blockers) + tests pass + docs complete
- Notification: Slack #cic-dev

**Tier 1 (Requires Approval)**: Major features only
- System architecture changes (new integration points, breaking APIs)
- Security gates or policy enforcement
- Multi-module refactors (>3 modules)
- New external dependencies
- Changes to governance processes

**Why:** Skills are low-risk, high-frequency. Governance overhead should match risk. Major features have wider impact and require coordination.

**How to apply:** When reviewing/creating a new skill or script, check: is this an architecture change, security gate, or breaking change? If no, it's Tier 0 (auto-install). If yes, route through Tier 1 approval before merge.

**Documented in:** `kb-sync/docs/governance/skill-approval-rules.md` (canonical source)

**Related:** [[cic-design-system-preference]], [[global-operating-rules]] (if exists)

---
name: project-cost-governance-runtime-antigravity-build
description: Antigravity building cost_governance_runtime.py implementing CIC-AI-AGENT-COST-SPEC-001 + TorqueQuery routing policy; verify independently when claimed done
metadata: 
  node_type: memory
  type: project
  originSessionId: ca6f235a-14aa-484c-a926-c1930138e8be
  modified: 2026-08-02T02:13:16.971Z
---

Antigravity is implementing an "Agent Cost Governance Runtime" against
`CIC-GOVERNANCE/SPEC/CIC-AI-AGENT-COST-SPEC-001.md` (v1.0.0-candidate.1) and
`docs/meta/specs/torquequery-ai-agent-routing-policy.md`, both of which I
reviewed and patched (2026-08-01): fixed scope-ceiling inheritance pin,
7-item circuit-breaker precedence (safety/auth failure at rank 2), shared
`no_progress_count`, atomic budget check-then-reserve, `escalation_count`
evidence field, `model` vs `model_snapshot` distinction, rollback anti-flap
(50-task rolling window).

Planned files (none existed as of 2026-08-01, proposal-stage only):
`CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`,
`CIC-GOVERNANCE/adapters/cost_gate_adapter.py`,
`CIC-GOVERNANCE/tests/test_cost_governance_runtime.py`.

**Why:** design doc was presented as "updated to incorporate all your
requirements" but no files existed yet — proposal framed as done work.

**How to apply:** when Antigravity reports this build complete, verify
against the actual spec text (both files above) independently before
trusting pass/fail claims — see [[feedback_verify_subagent_test_reports]].
Specifically check: rate-card pin reused at reservation time (not
re-fetched), both `model` and `model_snapshot` wired into evidence emission,
precedence order matches the 7-item list exactly, scaling gate stays
REPORT_ONLY pending Tier 1.

---
name: project-multi-agent-handoff-protocol-spec-2026-08-17
description: "Governance spec drafted at docs/meta/governance/multi-agent-handoff-protocol.md to close the recurring unreviewed-squash-on-main pattern (5a86f23); 4 review rounds, two-gate ratification model, not yet committed or Tier 1 approved."
metadata: 
  node_type: memory
  type: project
  originSessionId: 464d12e6-06ec-459c-bff6-bbb2cc379d35
  modified: 2026-08-17T23:55:51.137Z
---

Drafted `docs/meta/governance/multi-agent-handoff-protocol.md` (proposed Section 13) in response to 5a86f23 recurrence — see [[feedback_codex_scope_creep_autopush_sigil]] and [[feedback_checkin_before_session_cap]]. Went through 4 review rounds (external reviewer, each round found real P1/P2 gaps, all addressed).

**Core design, converged:**
- Handoff artifact: append-only `.jsonl` per SDD run (`.ijfw/handoffs/<run_id>-<seq>.jsonl`), atomic materialized view — not overwrite-in-place, survives hard session-cap kills
- Pickup (`picked_up_utc`) ≠ review-complete (`closed_utc`) — closure gated on every `commit_coverage` SHA reaching `review_status.state: "reviewed"` with a `review_event_ref`
- Review evidence authoritative source = PR approval record or signed git note/tag, not the mutable JSON field (JSON is a reconciled cache)
- Reconciliation rule: enforcement must diff branch tip vs `commit_coverage`, fail closed on any uncovered reachable commit — not just "does a newer artifact exist"
- Checkpoint cadence: two independent thresholds (60min wall-clock for ALL runs regardless of task count; every 15 tasks for runs ≥15 tasks)
- 13.3 merge gate: single authoritative rule = remote branch protection (no direct/force push, required PR+review, applies to admins) — covers squash/FF/direct-push uniformly. Local hook demoted to defense-in-depth only (bypassable via --no-verify). Added bypass-detection audit as backstop.
- "Primary" agent = supervision mode (human reading output turn-by-turn), not tool identity — Codex/Antigravity can be primary or non-primary depending on dispatch mode
- Actor identity (predecessor_agent/successor_agent) is **self-asserted, unverifiable today** — real fix needs a session-issued signed credential system that doesn't exist; explicitly flagged out of scope for this doc, enforcement marked advisory-only until built
- Sigil folded in as **notify-only** layer (ping successor agent), never system of record — its in-memory relay loses state on restart, so git-committed JSON stays sole source of truth (see [[feedback_sigil_relay_state_and_mailbox_ambiguity]])
- **Two-gate ratification**: gate 1 = Tier 1 spec-approval (design sign-off only); gate 2 = implementation-complete + live-verified (including the actor-credential system) — only gate 2 makes 13.1–13.3 actually enforced, not just approved-on-paper

**Status as of 2026-08-17:** Doc written, all reviewer findings closed across 4 rounds, committed (`14b57bf`) and pushed to origin/main. Not yet Tier 1 approved (spec-approval gate still open).

**Phased build plan agreed:**
- Phase 0: Tier 1 spec-approval sign-off (no build cost)
- Phase 1 (**tonight's session**): handoff artifact schema + append-only `.jsonl`, checkpoint cadence, run_id/run_started_utc bootstrap minting — cheap, no infra, catches the "no check-in before cap" half of the 5a86f23 recurrence
- Phase 2: branch protection config on `main` (GitHub settings), bypass-detection audit job, local pre-commit hook — catches the mechanical bypass half
- Phase 3 (deferred, maybe indefinitely): actor-identity signed-credential system — real design project, currently just self-asserted/advisory

**Next session:** start Phase 1 build.

**Not yet built (listed in doc's Integration Points, all future work):** run_id/run_started_utc bootstrap minting in charter/dispatch flow, SDD-runner checkpoint emission, branch-protection config verification on `main`, local pre-commit hook, bypass-detection audit job, actor-identity credential system.

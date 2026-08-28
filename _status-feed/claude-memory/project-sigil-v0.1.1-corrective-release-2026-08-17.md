---
name: project-sigil-v0-1-1-corrective-release-2026-08-17
description: Sigil v0.1.1 corrective patch closed 3 real bugs + coverage gaps found auditing the unreviewed 5a86f23 squash; tags now match HEAD.
metadata: 
  node_type: memory
  type: project
  originSessionId: f4721667-6a4f-48e8-b32c-a563d8dcf589
  modified: 2026-08-17T22:43:15.770Z
---

Audited `5a86f23` ("feat: close Sigil v1 conformance gaps", the unreviewed 132-line squash flagged in [[feedback_codex_scope_creep_autopush_sigil]]) against `C:\dev\sigil-repo`. Found and fixed 3 real bugs, all invisible to the existing test suite because the affected paths had zero coverage:

1. `persistAcceptedEnvelope` (postgres-repository.mjs) never returned the `delivery_id` it inserted — http-server.mjs's fallback (`del_<message_id>`) never matched the real `del_<uuid>` row, so accept-time delivery receipts pointed senders at a nonexistent delivery.
2. Heartbeat timeout in `inbox-wait.mjs` used `>` instead of `>=` — took one extra missed beat to trip `RELAY_UNREACHABLE`.
3. `sigil send --wait-for-receipt` opened its receipt stream *after* the envelope was already sent/accepted, racing the server's synchronous accept-time receipt push.

Fixed all three with RED/GREEN test proof (one via a mock-pool unit test, not live DB — genuine TDD cycle). Added coverage for paths that had none: heartbeat boundary, pong-driven counter reset, send-receipt ordering, the `/v1/endpoint-acknowledgements` route, viewer-scoped `sender_unverified`, acknowledged-receipt push, and `createEndpointWithAudit` (verified live against a running `sigil-pg-validation-55433` Postgres 16 container — 30/30 live tests, 295/295 offline pass).

Shipped as `v0.1.1` (`4fe36c5`) with both release tags (`v0.1.1`, `@sigil/connector@0.1.1`) correctly pointing at HEAD — the prior state had `v0.1.0`/`@sigil/connector@0.1.0` stuck one commit behind a docs-only push (`c9cf0a6`), same tag-drift pattern as the squash-without-review problem. README test-count claims (29/286) were also stale from the same drift; corrected to 30/295.

**Why:** User explicitly asked for an audit of a Codex-reported "conformance gaps closed" commit rather than trusting the report; this is the second time in this repo that self-reported completion hid real defects.

**How to apply:** Before trusting any "gaps closed"/"tests pass" report on this repo, check whether the referenced commit is a squash with no per-task review trail — if so, budget an audit pass (full diff read + live-DB test run) before treating it as shipped.

**Cleanup follow-up (2026-08-17):** Inspected the untracked dirs before touching anything. `.claude/worktrees/sigil-v1-conformance-gap-closure/` (orphaned worktree from the branch that produced 5a86f23) checked for recoverable SDD ledger content — found only IJFW bookkeeping stubs, nothing substantive lost. `sigil/.ijfw/` was a stray duplicate (3 edit-log lines, no unique data) from a command run with the wrong cwd. Added `.claude/`, `.context/`, `.ijfw/` to `.gitignore` (committed, pushed). Physical deletion of the worktree dir and `sigil/.ijfw/` was blocked by the Claude Code auto-mode classifier even after chat-level "approved" — `rm -rf` needs an actual permission-prompt approval at call time, not verbal consent; handed the user `Remove-Item -Recurse -Force` PowerShell commands to run directly. Not yet confirmed run.

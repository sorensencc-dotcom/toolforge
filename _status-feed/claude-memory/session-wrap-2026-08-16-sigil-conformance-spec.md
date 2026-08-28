---
name: session-wrap-2026-08-16-sigil-conformance-spec
description: "Sigil v1 §18 conformance gap closure design spec — audited, drafted, reviewed 4 rounds (Codex + human), committed and pushed; writing-plans deferred to next session."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5ae3c205-297a-40a4-896d-c3fbc44ef13e
  modified: 2026-08-16T18:13:07.157Z
---

Audited `C:\dev\sigil-repo` (canonical checkout — NOT `C:\dev\sigil`, which
is a stale duplicate clone, several commits behind) against
`docs/specs/sigil-protocol-spec-v1.0.0-draft.md` §18's 25-item v1
conformance profile. Found 15 IMPLEMENTED, 7 PARTIAL, 2 MISSING (217 tests,
188 pass, 29 skip on live-PG gate).

Wrote `docs/specs/sigil-v1-conformance-gap-closure-design.md`, closing 8
§18 gaps (#8, #10, #13, #14, #19, #21, #22, #23) plus one non-§18 gap
(workstream H — sender delivery receipts + connector/relay heartbeat)
surfaced mid-session by an actual incident: the local in-memory relay
(`sigil relay up`) restarted and silently lost queued state, and a sent
message couldn't be distinguished as "delivered" vs "lost" without
manually asking the other agent over the mailbox. Durable/supervised
relay process (PostgreSQL-backed persistence + auto-restart/health
monitoring for the relay itself) was explicitly scoped OUT and pushed to
backlog — separate ops concern from the 8+1 design here.

Went through 4 review rounds before being considered ready for
`writing-plans`:
- Round 1 (Codex, over Sigil mailbox): 8 initial design issues — async/
  transactional races, replay-vs-duplicate ambiguity, undefined capability
  scope, audit-at-wrong-layer, task.result cross-reference gap, key-age
  isn't verification.
- Round 2 (Codex): 4 blockers on the round-1 fixes themselves — READ
  COMMITTED doesn't make the transaction atomic (needed explicit
  `SELECT...FOR UPDATE` row locking, not SERIALIZABLE), replay
  classification still ambiguous on expiry, capability target-scope
  still undefined, audit needs `conversation_id` + rejection-audit
  survives-rollback semantics.
- Round 3 (human/user, in-editor review): 5 blockers — quota model wrong
  for inbox *depth* (rolling counter can't decrement; needed depth
  derived live from delivery rows), replay lookup not scoped to sender
  endpoint (could misclassify another endpoint's colliding message_id),
  no single-transaction-bound-client requirement (FOR UPDATE is inert
  across pool connections), rejection-audit retry undefined, H's
  heartbeat had no numeric defaults. Plus hardening: capability registry
  fail-closed, ack upsert/revocation semantics, task ordering under
  concurrency, JCS package pin.
- Round 4 (human, decisions): locked `withTransaction` helper pattern,
  JSON-frame heartbeat (not native WS control frames — browser
  connectors can't see those), migration idempotency + dual-repository
  (postgres + memory-repository.mjs) test requirement, and closed all 4
  remaining open items (node:crypto-probe-first, rate/depth defaults
  100/500/200-per-min + 500 depth, heartbeat 15s/45s, capability seed
  confirmed complete).

Final spec: `docs/specs/sigil-v1-conformance-gap-closure-design.md`,
commit `07d61b8`, pushed to `origin/main`. Zero open items. Next session:
invoke `writing-plans` skill against this spec, then execute.

See [[feedback_sigil_relay_state_and_mailbox_ambiguity]] for the process
lesson from the in-session incident.

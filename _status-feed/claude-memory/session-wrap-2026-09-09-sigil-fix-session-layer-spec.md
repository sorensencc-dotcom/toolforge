---
name: session-wrap-2026-09-09-sigil-fix-session-layer-spec
description: Sigil FIX session layer (receiver-side seq gap-detection + resend) — brainstorm + eng review + CEO review + design doc all done; spec committed unpushed; next step is writing-plans in a fresh session.
metadata: 
  node_type: memory
  type: project
  originSessionId: cab98be3-f2b0-4910-a06c-bf137315d9f6
  modified: 2026-09-09T04:02:33.953Z
---

Sigil FIX session layer — discharges the backlog item parked in
`docs/specs/sigil-v1-conformance-gap-closure-design.md` section 10 (FIX
`MsgSeqNum` + `ResendRequest`, the receiver-side half; section 10 already
shipped the sender-side receipts + heartbeat).

**Done this session (2026-09-08 → 2026-09-09):**

- `superpowers:brainstorming` → Approach A locked: relay-assigned per-`(sender,
  conversation)` `stream_seq`, non-blocking detect-and-request, new
  `business.reject` NAK envelope.
- `/plan-eng-review` → SCOPE_REDUCED. **A1**: no cross-relay attestation for a
  relay-assigned seq (the "signed sync manifest" the design assumed does not
  exist — verified against migrations 016/017 + `relay/v1` module list) →
  Plan 1 is single-relay only. **A2**: resend fulfilment moved off the hot
  accept transaction (incident I1 rule). **CQ1**: generalize `federation_outbox`
  + `federation-reaper` into a shared `relay_jobs` queue, not a parallel copy.
  NAK split to Plan 2. 13 test gaps + 1 critical regression (federation drain
  green after the queue refactor) added.
- `/plan-ceo-review` → SELECTIVE EXPANSION. Accepted into Plan 1: fleet
  observability (7 metrics + logs + dashboard), `stream_seq` stamping behind a
  config flag for a bake period, out-of-order release + `unrecoverable_gap`
  event on permanent recovery failure. Deferred: `sigil session-status
  <conversation>` CLI.
- Design doc written, self-reviewed, committed.

**Artifacts (all in `C:\dev\sigil-repo`, branch `spec/fix-session-layer`,
commits `637c0e9` + `467fc99`, UNPUSHED):**

- `docs/superpowers/specs/2026-09-08-sigil-fix-session-layer-design.md` — Plan 1 design
- `docs/superpowers/specs/2026-09-08-sigil-fix-session-layer-ceo-plan.md` — scope record
- `docs/superpowers/specs/2026-09-08-sigil-fix-session-layer-RESUME.md` — one-screen resume
- `TODOS.md` — 3 deferred items appended (NAK Plan 2, federated signed per-stream
  checkpoint, session-status CLI)

**Next:** `superpowers:writing-plans` against the design doc → implementation
task breakdown. Design's Parallelization section sketches the two lanes.
Codex outside-voice on the design was skipped (no plan-mode file at review
time); optional to run now.

**Watch:** CWD drifted between `C:\dev` and `C:\dev\sigil-repo` mid-session;
work is in `sigil-repo`. `sigil` MCP was disconnected at handoff.

Related: [[feedback_frontload_plan_review]], [[feedback_verify_ai_design_doc_premises]]
(A1 was exactly this — a design premise citing a component that does not exist).

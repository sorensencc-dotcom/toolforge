---
name: session-wrap-2026-08-30-sigil-routing-spec
description: "Sigil federation sub-project #3 (inter-relay routing) design spec written, reviewed once, committed; next step is writing-plans"
metadata: 
  node_type: memory
  type: project
  originSessionId: 26c9e630-f048-464c-8c85-9a77b8bc5fba
  modified: 2026-08-30T22:27:37.195Z
---

Brainstormed + wrote the design spec for Sigil federation **sub-project #3
(inter-relay routing)** — foreign-domain envelope forwarding to TOFU-pinned
peer relays (builds on #1 addressing + #2 trust/discovery, both landed).

**Spec:** `C:\dev\docs\superpowers\specs\2026-08-30-sigil-inter-relay-routing-design.md`
**Commit:** `94e55ef` on branch `spec/sigil-inter-relay-routing` in `C:\dev`
(NOT sigil-repo — see below).

**Location misfire:** first wrote it to `C:\dev\sigil-repo\docs\superpowers\specs\`
and committed there (`feat/inter-relay-routing`, `3c2fc02`). User: policy
violation — every spec lives in `C:\dev\docs\superpowers\specs\`. Fully
unwound the sigil-repo branch/commit (nothing pushed), rewrote at the
correct path with cross-refs pointing at `sigil-repo/docs/...` for the
#1/#2 specs. Remember: **specs → `C:\dev\docs\superpowers\specs\`**, even
for sigil work.

**Design shape (user-approved):** opt-in `sigil relay up --federation-mode
sync|queue --federation-identity <path>`. New module
`sigil/relay/v1/federation-router.mjs`, new route
`POST /v1/federation/envelopes`, relay-to-relay Ed25519 signature over JCS
canonical bytes (also the exact wire body), federated-inbound accept path
that skips sender registration but verifies a propagated sender key +
relay-signed `sender_owner_id`. Same-owner exemption only (cross-owner
first contact is #4). `federation_outbox` Postgres table for queue mode,
retry via the existing per-minute delivery reaper.

**Outside review (Codex) — 3 blockers fixed in `94e55ef`:**
1. Same-owner exemption was impossible: #1 forces owner-domain ==
   relay-domain, so cross-federation owners never match. Fix: keyed off a
   relay-signed `sender_owner_id` wire field + a **prerequisite #1
   amendment** `sigil init --federation-owner <federated-id>` letting one
   owner id be shared across relays. Plan's FIRST task must be this
   amendment.
2. Hop prevention: rewritten structural/origin-only; receiver always
   stores `federation_hop = true`, no wire hop marker.
3. Queue lease: added `processing` state + `claimed_at`/`claim_token`
   (300s lease), `FOR UPDATE SKIP LOCKED` claim, ownership-guarded
   finalize, because the HTTP call happens after the claim commits.
   Plus folded-in: bounded peer-4xx code parsing, idempotent-duplicate
   accept, advisory-only `sigil route test` owner line.

**Next session:** review `94e55ef`, then invoke superpowers:writing-plans.
Plan task 1 = the #1 `--federation-owner` amendment. See
[[feedback_verify_ai_design_doc_premises]] — every named primitive in this
spec was grep-checked against sigil-repo HEAD.

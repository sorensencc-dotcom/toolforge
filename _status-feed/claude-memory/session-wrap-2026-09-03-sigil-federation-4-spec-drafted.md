---
name: session-wrap-2026-09-03-sigil-federation-4-spec-drafted
description: "Sigil federation sub-project #4 (cross-federation directory) design spec drafted + twice-reviewed; awaiting user read then writing-plans. Also closed #3 doc debt (I1 fabb4fe, I4 MAX_ATTEMPTS=4)."
metadata: 
  node_type: memory
  type: project
  originSessionId: f045ee3a-091d-4f58-8b67-f91e73bd2a05
  modified: 2026-09-03T12:47:47.121Z
---

Session 2026-09-03 (ran ~12h, long). Two things done, both on `C:\dev` `main`, **4 commits NOT pushed**:

## 1. #3 routing doc debt — CLOSED (`7037895b`)
`docs/superpowers/{plans,specs}/2026-08-30-sigil-inter-relay-routing*`:
- spec I1 "Resolved" block now lists `fabb4fe` (B1-completion: Phase 1 `try` was placed *after* `decideRoute`, so `RECIPIENT_NOT_LOCAL`/`MALFORMED_FEDERATED_ID` escaped `acceptEnvelopeAsync` unhandled — red on main since `8fdd1fb`).
- `MAX_ATTEMPTS = 4` (final-review fix I4) folded into 3 stale spots: queue-reaper transport-failure bullet, "reuses delivery-reaper policy" note, `federation.dead_letter` observability line. Delivery reaper stops at 3; federation walks all 3 backoff tiers (1m/5m/30m) → dead-letter after the 4th.
- plan Task 11 no-op-transaction Note marked superseded by I1.

## 2. Sub-project #4 spec — DRAFTED + 2 review passes, NOT yet planned
`C:\dev\docs\superpowers\specs\2026-09-02-sigil-cross-federation-directory-design.md` (~950 lines).
Commits: `7a80dd07` initial → `2f242728` Codex review → `584a7cf9` caveman-review.

**Scope (locked with user):** #4 = cross-federation **directory only**. Presence / cross-federation delivery receipts / cross-relay OIDC-match are non-goals → their own later sub-project.

**Design:** relay-forwarded invite-code on-ramp. Self-describing code `sigil-fed-invite:<issuer-domain>:<link_ref>:<segment>` (link_ref embedded so both relays key rows without a round-trip; `code_hash = sha256(segment)` over the secret part only). Redeemer redeems on *their own* relay; that relay posts to the issuer over 3 new relay-signed routes `POST /v1/federation/directory/{redemptions,confirmations,revocations}`. **Mutual rows**: each relay writes its own `federation_directory_links` row; each human's confirmation set locally by an authenticated human session, the peer's arrives as a signed relay-to-relay message drained via #3's `federation_outbox` (+ new `kind` column + `directory_payload jsonb`, migration `018` drops `017`'s NOT NULL on envelope/sender_key/sender_owner_id). Row `active` only when both `local_confirmed_at` + `remote_confirmed_at` set; CAS on `status='pending'` so **revocation always wins**. `acceptFederatedEnvelope` step 8 gains a 2nd pass: after the #3 same-owner exemption, an **active `federation_directory_links` row on the receiving relay** for (recipient owner, relay-attested sender_owner_id, origin_domain) → deliver, else the existing `DIRECTORY_LINK_REQUIRED`. Origin forward carries NO link claim — receiver's own row is sole authority. Postgres-only (in-memory → `501 FEDERATION_DIRECTORY_UNAVAILABLE`). New modules: `federation-relay-auth.mjs` (extracted from #3, resolves origin relay from `Sigil-Relay-Key-Id` via new `getPeerByKid`), `federation-directory-client.mjs`, `accept-federation-directory.mjs`.

**Review findings applied:** Codex (7): trust-boundary claim softened (each relay vouches for its own humans, bounded by pinning, symmetric to #3 `sender_owner_id`); revoke-vs-confirm CAS; `409 FEDERATION_LINK_EXISTS` for owner-pair collision; issuer-domain-in-code == relay's own `--domain`; timestamp policy (audit-only, server `now` authoritative); replay handled structurally via unique per-invite `link_ref`. caveman-review (7): link_ref-in-code (was unknowable to redeemer relay pre-round-trip — the one真 blocker), migration 018 NOT NULL fix, kid-based origin resolution, orphaned-`pending`-link → reaper marks `expired` (`markFederationDirectoryLinkExpired`), dropped cargo-culted `home_relay`, 501-before-sig-work.

## NEXT (fresh session)
1. User reads `584a7cf9` spec → approves or requests changes (brainstorming user-review gate).
2. On approval: invoke `writing-plans` skill → implementation plan under `C:\dev\docs\superpowers\plans\`. Code repo is `C:\dev\sigil-repo` (preflight `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`); branch off `main`.
3. `git push` the 4 `C:\dev` main commits when ready (`7037895b 7a80dd07 2f242728 584a7cf9`).

## Side notes
- User wants a FIX-protocol-style (fixprotocol.org) session layer for Sigil peer messaging — seqnums, Logon/Logout, Heartbeat/TestRequest, ResendRequest/SequenceReset. Distinct **larger** sub-project; would fold in the deferred #4 presence work. Deferred behind #4. See [[session-wrap-2026-09-02-sigil-i1-slice-shipped]].
- `sigil-consult` skill has NO ack/receipt step — send + one background `inbox --wait` + report. First `--wait` lapsed at 300s and I narrated instead of instantly re-arming; Codex's reply landed in the gap (re-arm caught it, nothing lost — Sigil inbox persists regardless). If adding receipts: peer emits a receipt msg on pickup, or poll relay-side delivery state.
- Relay was started on 8791/8793 for the Codex consult, stopped at session end.

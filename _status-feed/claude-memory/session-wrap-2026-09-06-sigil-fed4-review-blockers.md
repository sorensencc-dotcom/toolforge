---
name: session-wrap-2026-09-06-sigil-fed4-review-blockers
description: "Sigil cross-federation-directory branch final review found 3 verified security blockers; NOT ship-ready, needs spec not patch"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3d6fe746-2714-4ff0-8436-606373a236f8
  modified: 2026-09-06T15:40:08.113Z
---

Session 6 of the Sigil federation #4 (cross-federation directory) SDD. Ran the
final whole-branch `/code-review high` against `b11dfc3..a68382e` in
`C:\dev\sigil-repo`, branch `feat/cross-federation-directory` (22 commits, all
17 SDD tasks done, HEAD `a68382e`, tree clean, NOT pushed).

**Outcome: branch is NOT ship-ready.** `finishing-a-development-branch` is
blocked. Three security findings verified directly against source this session:

1. **SAME-OWNER-EXEMPTION-BYPASS (Critical)** — `accept-federated-envelope.mjs:140`.
   `sender_owner_id` / `envelope.sender.owner_id` domain is never pinned to
   `origin_domain`. Any pinned peer sends an envelope asserting a *local* owner
   id as sender; Step 8's `senderOwnerId === recipient.owner_id` same-owner
   exemption fires and delivers with **no directory link** — the whole branch's
   gate bypassed for the self-owner case.
2. **REDEEMER-OWNER-DOMAIN-UNPINNED (Important)** — `accept-federation-directory.mjs:66`.
   `redeemer.owner_id` is only `parseFederatedId`'d; `endpoint_id` and
   `redeemer_domain` are pinned but `owner_id` isn't → issuer-side link written
   with `remote_owner_id` on a domain the peer doesn't control.
3. **NO-REPLAY-PROTECTION (Important)** — `federation-relay-auth.mjs`.
   `verifyInboundRelayRequest` has no timestamp/nonce/freshness check. STATUS.md
   claims "timestamp, replay, and domain pinning validation" — false. Replayed
   directory revocation cuts cross-fed delivery; replayed redemption griefs peer
   quota.

Plus likely-real E2 (CLI redeem trusts issuer-response owner ids' domain) and
~15 Minor/cleanup items (plaintext invite code dumped by `outbox show` +
persisted in `federation_outbox.directory_payload`; dead `verifyRelaySignature`
export; dead `initiated_via` column; memory-vs-PG repo parity gaps). Full list
in the SDD ledger: `sigil-repo/.superpowers/sdd/2026-09-03-sigil-cross-federation-directory/progress.md`
(SESSION 6 entry).

The `/code-review` skill's verify pass was abandoned mid-run (~1h grinding ~40
candidates, 7 of 8 finders reported). Raw finder reports live only in the
session 6 transcript.

**RESUME (fresh session):** the 3 blockers need a spec/brainstorm, not a quick
patch — decide where owner-domain pinning belongs across the envelope +
redemption + CLI-redeem paths, and pick a replay defense (nonce table +
migration vs signed freshness window). Then TDD implement with a RED test
proving each exploit first, re-review, then `superpowers:finishing-a-development-branch`.
Do NOT push. See [[session-wrap-2026-09-05-sigil-fed4-task16-17-closed]].

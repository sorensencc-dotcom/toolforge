---
name: session-wrap-2026-09-07-sigil-fed4-security-plan-written
description: "Sigil Fed #4 security-hardening TDD plan written (14 tasks), uncommitted; RESUME at /plan-eng-review then SDD"
metadata: 
  node_type: memory
  type: project
  originSessionId: a67ab42c-7f5c-4f2c-baf1-2ed7203048fd
  modified: 2026-09-07T12:23:43.519Z
---

Sigil cross-federation directory (#4) **security-hardening TDD plan written**.
Picks up from [[session-wrap-2026-09-06-sigil-fed4-security-plan-nonstart]]
(that session ran ~4h, wrote nothing, was killed).

**Plan file (UNCOMMITTED):**
`C:\dev\sigil-repo\docs\superpowers\plans\2026-09-06-sigil-federation-directory-security.md`

**Spec (APPROVED):** `6d0647b`,
`C:\dev\sigil-repo\docs\superpowers\specs\2026-09-06-sigil-federation-directory-security-design.md`
(revision 2). Branch `feat/cross-federation-directory`, HEAD `021393e`, off main
`b11dfc3`, unpushed. Keep the 2 CLI commits `6ded8d0`+`021393e` from the other agent.

**Plan shape: 14 tasks.** Covers spec Sections 1-8 (coverage table in the plan's
Self-Review). Order + deps:
- T1 migration `019_federation_directory_security.sql` — `federation_relay_nonces`
  table; 2 CHECK replacements on `federation_directory_links`
  (`initiated_via` gains `self_pair`; `distinct_owners` allows equal owners iff
  `self_pair`) behind a DO-block name assertion; pre-019 `directory_redemption`
  row code-scrub.
- T2 `consumeRelayNonce`/`pruneRelayNonces` on postgres-repository +
  memory-repository (Map-backed).
- T3 `resolveRelayRequestFreshnessMs` clamp helper in `relay-config.mjs`
  (default 300_000, clamp [60_000, 3_600_000]).
- T4 `verifyInboundRelayRequest` gains `{ now, freshnessMs }`, enforces
  `signed_at` freshness (`RELAY_REQUEST_STALE`/401) + nonce format
  `^[A-Za-z0-9_-]{22}$` (400), returns `nonce`+`signedAtMs`.
- T5 builders (`federation-directory-client.mjs` x3 + `buildForwardRequest`)
  emit `nonce`+`signed_at`, drop `requested_at`/`confirmed_at`/`revoked_at`/
  `forwarded_at`; `newRelayNonce()` exported; confirmation/revocation handlers
  read `signed_at`. Moves the malformed-timestamp tests to `signed_at`.
- T6 `createFederationDirectoryLink` gains `initiatedVia` param;
  `acceptDirectoryRedemption` + CLI redeem set `self_pair` when owners equal.
- **T7 ordering-locked (single commit, RED exploit + GREEN self-pair):** delete
  the same-owner exemption in `accept-federated-envelope.mjs:139-154`; directory
  gate runs unconditionally. Depends T1+T6. Memory test inserts the self-pair
  link directly (no CHECK on memory repo).
- T8 B2 — pin `redeemer.owner_id` domain in `accept-federation-directory.mjs`.
- T9 E2 — `assertIssuerResponseIdentity(issuer, issuerDomain)` pure export +
  CLI `cmdFederationInviteRedeem` reject/audit(`federation_directory.invite_redeem_rejected`)/exit 1.
- T10 B3 — consume nonce as first stmt inside each handler tx (`http-server.mjs`
  directory route + `accept-federated-envelope.mjs`); `RELAY_REPLAYED`→409;
  `RELAY_REQUEST_STALE` audit with skew; thread `relayRequestFreshnessMs`
  through `createRelayServer`.
- T11 B3 reaper — rebuild `directory_confirmation`/`directory_revocation` via
  builders each pass (stored payload only `{ link_ref }`); delete
  `directory_redemption` path, `writeRedeemerLink`, `PATH_BY_KIND` key; header
  comment. CLI confirm/revoke enqueue payload → `{ link_ref: linkRef }`.
- T12 Q4 — `outbox show` strips `directoryPayload`.
- T13 Q4 — redemption loses durable retry: delete the
  `enqueueFederationForward({kind:'directory_redemption'})` branch; print
  `re-run 'sigil federation invite redeem <code>'`; exit non-zero.
- T14 STATUS.md replay-claim fix + full-suite green + spec Section 7 precondition
  checks.

**4 test steps (T10/T11/T12/T13 Step 1) carry arrange-act-assert skeletons, not
literal code** — flagged in Self-Review §2; executor must fill from each target
test file's real harness. Everything else is literal.

**Baseline:** non-DB `node --test` 812 pass / 0 fail / 103 skip; live-DB 112 pass.
Local pg `localhost:55432`, `sigil:sigil_password` / `sigil_test`,
`SIGIL_TEST_DATABASE_URL`. T1/T2/T6/T10 have Postgres-gated tests.

**RESUME (fresh session):**
1. Preflight `pwsh -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`.
2. `/plan-eng-review` on the plan file — **hard stop, not yet run**, no commit before it.
3. Fold findings into the plan, then commit the plan.
4. SDD via `superpowers:subagent-driven-development` — 14 tasks, commits on
   `feat/cross-federation-directory`. T7 ordering-locked.
5. Re-review `b11dfc3..HEAD`, then `superpowers:finishing-a-development-branch`.
6. **Do not push.**

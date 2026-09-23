---
name: session-wrap-2026-09-03-sigil-federation-4-plan-written
description: "Sigil federation #4 (cross-fed directory) — 17-task subagent-driven impl plan written, committed + pushed to C:\\dev main d6596255; NEXT session runs SDD against it in C:\\dev\\sigil-repo"
metadata: 
  node_type: memory
  type: project
  originSessionId: 17fdcb4c-2401-4455-bd0f-c90c5200f2f9
  modified: 2026-09-03T19:46:05.410Z
---

Continuation of [[session-wrap-2026-09-03-sigil-federation-4-spec-drafted]].

## Done this session
- Pushed the 4 spec commits (history had been rebased by IJFW hook; only caveman-review pass `584a7cf9` remained → rebased onto v2.63.0 release → `b895b31d`, pushed).
- Wrote the **implementation plan** via `superpowers:writing-plans`: `C:\dev\docs\superpowers\plans\2026-09-03-sigil-cross-federation-directory.md` (2165 lines, 17 tasks, TDD steps with real code/test blocks). Committed + pushed to `C:\dev` `main` as **`d6596255`** (origin up to date).
- Implements spec `C:\dev\docs\superpowers\specs\2026-09-02-sigil-cross-federation-directory-design.md`. Code repo is **`C:\dev\sigil-repo`** (NOT C:\dev).

## Two design questions — RESOLVED + LOCKED in the plan (user confirmed)
1. **Redeemer-side link row identity (Tasks 13, 11):** synchronous redemption POST from `sigil federation invite redeem` — write the redeemer `federation_directory_links` row fully populated from the `202` body `{ link_ref, issuer }`. `federation_outbox` row is retry fallback only on sync-POST failure; reaper's `202` branch then writes the row idempotently. No sentinel, no backfill.
2. **No-`--federation-mode` route (Task 10):** fail-closed `501 FEDERATION_DIRECTORY_UNAVAILABLE` for both a non-Postgres relay AND a Postgres relay without `--federation-mode`. Gate: `!federationMode || typeof repository?.enqueueFederationForward !== 'function'`.

## Task list (plan has full detail)
1 migration 018 (2 tables + `federation_outbox` kind/directory_payload + relaxed NOT NULLs + quota scopes) · 2 `getPeerByKid` both repos · 3 `federation-relay-auth.mjs` `verifyInboundRelayRequest` · 4 refactor `acceptFederatedEnvelope` steps 1–3 onto it · 5 `federation-directory-client.mjs` builders + `postDirectory` (share w/ `postForward`) · 6 invite repo methods · 7 link repo methods (CAS confirm, revoke-wins, `FEDERATION_LINK_EXISTS`, step-8 lookup) · 8 `acceptDirectoryRedemption` · 9 `acceptDirectoryConfirmation`+`acceptDirectoryRevocation` · 10 3 HTTP routes + 501 pre-gate · 11 reaper `kind` dispatch + link-expire · 12 step-8 active-link 2nd pass · 13 CLI `federation invite` · 14 CLI `federation link` · 15 `route test` advisory line · 16 3 rate scopes · 17 live-DB matrix + regression + push.

## NEXT SESSION (fresh — user asked to switch)
Run **`superpowers:subagent-driven-development`** against the plan. Fresh subagent per task, two-stage review between. Progress ledger → `C:\dev\sigil-repo\.superpowers\sdd\2026-09-03-sigil-cross-federation-directory\progress.md`. No blockers before Task 1.

## Live-infra gotchas (unchanged)
- IJFW background hook **juggles branches mid-session** — my plan commit first landed on `ironledger/phase-2a-evidence` (`7cbe7e54`, a now-orphan dup); cherry-picked onto `main` as `d6596255`. Always `git branch --show-current` + `git log` before/after any commit in `C:\dev`.
- sigil-repo pre-push runs full `node --test` >10min; ONE run at a time, `Stop-Process node` zombies first. Local pg `localhost:55432` (`sigil:sigil_password`/`sigil_test`); test suites skip without `SIGIL_TEST_DATABASE_URL`.
- CRLF repo: use `sed -i` for token edits, check `git diff --stat` before staging.

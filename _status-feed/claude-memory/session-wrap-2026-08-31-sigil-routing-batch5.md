---
name: session-wrap-2026-08-31-sigil-routing-batch5
description: "Sigil inter-relay routing SDD Batch 5 (Tasks 13-16, queue + reaper) shipped + pushed; rulings R14/R15"
metadata: 
  node_type: memory
  type: project
  originSessionId: 55cdffef-b5bb-462e-a864-7796c1a2e749
  modified: 2026-08-31T23:20:21.451Z
---

SDD Batch 5 of the Sigil inter-relay routing plan (`C:\dev\docs\superpowers\plans\2026-08-30-sigil-inter-relay-routing.md`), worktree `C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing`, branch `feat/federation-inter-relay-routing`.

**Tasks 13-16 complete + PUSHED** `bab39b2..719d62c` to `origin/feat/federation-inter-relay-routing` on 2026-08-31. Pre-push gate green: 807 tests / 728 pass / 0 fail / 79 skip (live-ollama PASSED this run, 689s). 19 commits ahead of sigil-repo main `7c2e867`.

- **Task 13** `f944687` federation_outbox repo methods (enqueue/claim/finalize/list/retry + rowToFederationOutboxRecord) on PostgresRepository only. Implementer had a live PG — new `postgres-repository.federation-outbox.test.mjs` 10/10. Review clean, 2 minors deferred.
- **Task 14** `a2e6fc5`→`366c721`→`3517b60` queue-mode `enqueueForward` in accept-envelope.mjs (R12 forward-ref from Batch 4 now live). Review ❌ R0 — the deliverable test was broken (never `upsertPeer`'d the peer → `PEER_NOT_PINNED` 400 before enqueue path; not hermetic; weak duplicate assertion). 2 fix rounds → clean.
- **Task 15** `18c16cd` `federation-reaper.mjs` (`runFederationReaperPass` + `startFederationReaper`). Claim-then-commit-before-forward, backoff `[60000,300000,1800000]` + `>=3` dead_letter, ownership-guarded finalize, 4xx terminal, expiry short-circuit. Review clean. Implementer #1 died before commit (files left untracked); implementer #2 (haiku) ran suites + committed.
- **Task 16** `719d62c` wire reaper into `sigil relay up` queue mode + error-string suffix `; in-memory relays have no durable outbox`. Was implemented+committed by a prior-session agent whose result was never seen; picked up at review this session. Review clean, 1 minor deferred.

**Rulings (for Task 19 finish list):**
- **R14** — Tasks 13/14 new live-DB test files guard AND take connection string from `process.env.SIGIL_TEST_DATABASE_URL`, NOT `SIGIL_DATABASE_URL` (brief said the latter, wrong — every repo pg/federation test + CI live-DB job use `SIGIL_TEST_DATABASE_URL`). Cost if wrong: files SKIP in CI, one-line fix. See [[feedback_verify_ai_design_doc_premises]].
- **R15** — reaper's unguarded `buildForwardRequest`/`signForwardRequest` (poison row can wedge the whole pass) accepted as brief-sanctioned documented limitation for Batch 5; deferred fix folded into Task 19 (try/catch → dead_letter `FORWARD_BUILD_FAILED`). Triggers near-impossible (enqueue stores validated envelope; bad identity caught at startup).

**Open / carry-forward:**
- Tasks 13/14 live-DB tests SKIP locally — CI live-DB matrix is first real execution of the Task 13/14 Postgres path (R10-class item, still open). If CI live-DB red: migration 017 CHECK constraints, claim SQL `::timestamptz`/`::double precision` casts, `ON CONFLICT (message_id, idempotency_key)` re-SELECT.
- **Batch 6 = Tasks 17-19** (`sigil federation outbox list|show|retry`, `sigil route test`, close-out). Task 17 consumes Task 13's `listFederationOutbox`/`getFederationOutboxRow`/`retryFederationForward` (produced, not consumer-reviewed). Batch 6 is the LAST batch → the plan's only whole-branch final review runs after Task 19, on the most capable model, pointed at the ledger's deferred-minor + Ruling lines.
- Ledger + workspace RETAINED at `.superpowers/sdd/2026-08-30-sigil-inter-relay-routing/progress.md` — has a Batch 6 start checklist.

Prior batches: [[session-wrap-2026-08-31-sigil-routing-batch4]], [[session-wrap-2026-08-31-sigil-routing-batch3]], [[session-wrap-2026-08-31-sigil-routing-batch2]], [[session-wrap-2026-08-31-sigil-routing-batch1]], [[session-wrap-2026-08-30-sigil-routing-plan]].

---
name: session-wrap-2026-08-31-sigil-routing-batch3
description: "SDD Batch 3 (Tasks 8-10, federated-inbound receiver) complete + pushed; R6 resolved in code via R10; R11 ruled; CI live-DB is the open item"
metadata: 
  node_type: memory
  type: project
  originSessionId: d0a5c0d7-3e49-4a2f-ab17-e51432993d4d
  modified: 2026-08-31T13:13:44.966Z
---

Sigil inter-relay routing (federation #3), `superpowers:subagent-driven-development`, one batch per session.
Worktree `C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing`, branch `feat/federation-inter-relay-routing`.
Ledger (the resume point, has everything): `<worktree>/.superpowers/sdd/2026-08-30-sigil-inter-relay-routing/progress.md`.
Plan: `C:\dev\docs\superpowers\plans\2026-08-30-sigil-inter-relay-routing.md`.

## Batch 3 done — branch @ `35a7c15`, PUSHED to origin (local == origin)
13 commits ahead of sigil-repo main `7c2e867`; 4 new this batch:
- `d122815` Task 8 — `acceptFederatedEnvelope` checks 1-5 (structural/trust/relay-sig/sender-domain/envelope-sig). Clean first pass.
- `5d4c386` Task 9 — checks 6-10 + R10 shadow-upsert + R11 guard.
- `2a906de` Task 9 fix round 1 — `federation_origin` `quota_usage_scope_kind_check` migration + unknown-error-code mapping + 422 status assert.
- `35a7c15` Task 10 — `POST /v1/federation/envelopes` route (unauthenticated, sits before the auth gate). Clean first pass.
Per-task reviews all clean. Task 9 = 1 fix round. Pre-push gate 778/710 pass/0 fail/68 skip; dep+JCS audits + live-Ollama PASS.
NO batch-end whole-branch review (plan line 1933 — only after Task 19).

## Rulings this session (for the plan-close finish list)
- **R11** (Task 9): plan's recipient-active guard `recipient.status !== 'active'` throws `RECIPIENT_NOT_FOUND` for every valid recipient on Postgres — `PostgresRepository.lookupRecipientEndpoint` returns `{endpoint_id, owner_id}` with no `status` field (SQL already active-filters); memory-repo method returns an entry carrying `status` so memory tests stayed green. Weakened to reject only on explicit non-active status. Implemented + reviewer-verified. Cost if wrong: one-line predicate in a new file, pinned by R10's live-DB test.
- Gap-fill inside R10 (no new letter): the `federation_origin` rate scope the plan introduced (line 1303) had no companion `quota_usage_scope_kind_check` migration → 23514 on every PG federated accept. Fixed in migration 017: DROP/ADD the CHECK with `federation_origin` appended to `012_directory_trust.sql`'s 7-value list (no value dropped). Only caught because the Task 9 reviewer traced the PG path; memory `reserveRateLimit` has no CHECK.

## R6 status — RESOLVED IN CODE this batch (was the Batch 1/2 carry-forward blocker)
R10 shadow-upsert shipped: `PostgresRepository.registerFederatedSender` + `MemoryRepository.registerFederatedSender` (`INSERT ... ON CONFLICT DO NOTHING` into humans/endpoints/endpoint_keys), called inside `acceptFederatedEnvelope`'s transaction after all reject-capable checks, before `persistAcceptedEnvelope`. Migration 017 amended: `ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS origin_domain TEXT` + the quota CHECK above. Reviewer verified NOT-NULL coverage complete (checked 001 + all later migrations), parent-first INSERT order, composite-FK alignment `(sender_endpoint_id, sender_owner_id) -> endpoints(endpoint_id, owner_id)`.

## OPEN VERIFICATION ITEM — carry to Batch 4
R10's entire Postgres path (`registerFederatedSender` SQL, migration order, composite FK, `federation_origin` CHECK) has NEVER executed. `sigil/relay/v1/accept-federated-envelope.pg.test.mjs` exists (asserts 202 + envelopes row + `endpoints.origin_domain`) but SKIPS locally — no `SIGIL_TEST_DATABASE_URL`, no local Postgres. **CI live-DB matrix on this push is its first real run.** If CI live-DB is red, that test is where to look.

## Next session = Batch 4 (Tasks 11-12, sync origin)
Ledger's "Batch 4 start checklist" has the steps. Key: Task 11 REPLACES the `checkRecipientLocality` call in `accept-envelope.mjs` with `decideRoute` (Batch 2's `federation-router.mjs`) — conflict-scan `decideRoute` signature + return shape vs what Task 11 expects before dispatching. Deferred minors from Batches 1-3 all roll into Task 19; list is in the ledger.

See [[session-wrap-2026-08-31-sigil-routing-batch2]], [[session-wrap-2026-08-31-sigil-routing-batch1]], [[feedback_verify_ai_design_doc_premises]].

---
name: session-wrap-2026-09-02-sigil-federation-ci-green
description: "Federation #3 live-DB CI gate turned green; both broken suites fixed + pushed; I1 still parked"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0340a485-93ce-48d9-a91a-4936ea27472b
  modified: 2026-09-02T12:44:25.349Z
---

Federation #3 (inter-relay routing) CI live-DB gate is **green** as of 2026-09-02.

Two new federation live-DB suites had broken test setup (product code + migrations
unaffected). Fix landed as `0829eb5` on `sigil-repo` `origin/main`, CI run
33610373355 success on all 5 jobs (secret-scan, Linux+Windows × Node 22/24).
STATUS.md recorded it in `85e818a`. `origin/main` now at `85e818a`.

Root causes:
1. `sigil/cli/sigil-federation-outbox.test.mjs` — raw-applied migrations via
   concatenated `pool.query()` without seeding `_sigil_schema_migrations`. The
   shelled `sigil federation outbox` CLI runs `withRepository(..., {migrate:true})`
   → `applyMigrations` replays non-idempotent `014_oidc_issuer_client_id.sql`
   (bare `ADD COLUMN client_id`, no `IF NOT EXISTS`) → CLI exits 1. Fix: use
   `applyMigrations(connectionString, {reset:true})` so the ledger is seeded.
2. `sigil/relay/v1/accept-envelope.federation-queue.test.mjs` — three bugs:
   `upsertPeer({trustMode:'pinned'})` violates `peer_relays_trust_mode_check`
   (`016` allows only `tofu`/`static`) → use `static`; row assertions read
   snake_case (`row.message_id`) but `listFederationOutbox` returns camelCase
   (`row.messageId`) → switch keys; double teardown (`t.after(pool.end)` +
   `finally repository.close()`) threw "Called end on pool more than once" →
   single `t.after(() => repository.close())`, drop the try/finally.

This session: independently verified the fix (ran `npm run test:live` locally
against `sigil_postgres` :55432 — 21 files / 93 tests / 0 fail; both suites green
standalone) and confirmed the CI run. The commit itself was produced by the
sigil-repo auto-commit/autopush hook mid-session — branch `fix/federation-live-db-ci-green`
created then absorbed and deleted by the hook, HEAD auto-fast-forwarded twice.
Diff matched the intended fix exactly; no correction needed. See
[[feedback_codex_scope_creep_autopush_sigil]].

Still open: I1 sync-forward transaction-boundary fix — PARKED. Handoff at
`…/scratchpad/HANDOFF-sigil-i1.md` has the reviewed-but-not-ready plan with 5
issues (B1 reject/forward error `{status,body}` loss, B2 queue-mode txn loss,
S1 null-client hard-throw at `postgres-repository.mjs:79`, S2/S3 doc gaps).
Next session: revise that plan, implement I1 as its own slice.

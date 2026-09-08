---
name: session-wrap-2026-09-01-sigil-routing-pushed-ci-red
description: "Sigil federation #3 merge verified + pushed to origin/main; CI live-DB gate red on 2 broken new test suites (not product code)"
metadata: 
  node_type: memory
  type: project
  originSessionId: d67908dc-5aa0-43d7-b5ef-a04121c22c7c
  modified: 2026-09-02T03:41:08.297Z
---

Continuation of [[session-wrap-2026-09-01-sigil-routing-merged]]. Federation
sub-project #3 (inter-relay routing) in `C:\dev\sigil-repo`.

## Done this session
- **Verified merge `5c389e9`** (the auto-commit hook had resolved the
  `sigil/cli/sigil.mjs` conflict last session). `git diff` against both parents:
  clean union — `relay well-known generate` (from `main` parent `b4c2c6c`) plus
  `init --federation-owner`, `relay up --federation-mode/--federation-identity`,
  `cmdFederation`, `cmdRoute`, reaper wiring (from branch parent `965b968`) all
  coexist, no dup dispatch, nothing dropped. `node --check` OK, offline CLI tests
  pass.
- **Pushed `main` → `origin/main` (`5c389e9`, was 27 ahead).** Pre-push gate ran;
  the `git push` call wall-timed at 2 min but the push completed —
  `git ls-remote origin refs/heads/main` = `5c389e9`, `rev-list --count
  origin/main..main` = 0.
- **Branch cleanup:** `feat/federation-inter-relay-routing` was already gone both
  sides (remote ref deleted post-merge, local branch + worktree removed by the
  sigil-repo auto-commit hook). `git remote prune origin` clean. Nothing to do.
  Stray still-present local branch `feat/relay-well-known-generate` @fc22c9b
  (`[origin: gone]`, content in `main` via PR #2) — safe `git branch -D`, left it.
- Updated `sigil-repo/STATUS.md`: goal, Tests, Blockers, Next action.

## CI is RED — run 33568029999 (push of 5c389e9)
Windows Node 22/24 + Secret-scan green. Linux Node 22.x + 24.x fail at the
**"Run Live PostgreSQL Gate"** step only. "Run Unit & Contract Tests" passes
757/0. `npm run test:live` fails **2 of 21** schema-resetting suites. Both are
new in this branch and both are **broken test setup, not product bugs** — the
federation production code and migrations `014`/`016`/`017` are fine.

1. **`sigil/cli/sigil-federation-outbox.test.mjs:56`** — CLI exits 1 with
   `column "client_id" of relation "oidc_issuer_allowlist" already exists`, so
   `assert.equal(list.exitCode, 0)` → `1 !== 0`. The test raw-applies every
   `sigil/migrations/*.sql` via concatenated `pool.query()` **without seeding the
   `schema_migrations` ledger**, then shells `sigil federation outbox list`.
   `cmdFederation` is the first CLI surface to pass
   `withRepository(..., { migrate: true })`; the CLI migrator sees an empty
   ledger and replays `014_oidc_issuer_client_id.sql`
   (`ALTER TABLE ... ADD COLUMN client_id TEXT` — no `IF NOT EXISTS`) onto a DB
   that already has the column. Fix in the test: seed the ledger after the raw
   apply, OR leave `SIGIL_DATABASE_URL` unset on a clean schema and let the CLI
   be the only migrator, OR call the shared migrate helper. Optional hardening:
   `ADD COLUMN IF NOT EXISTS` in `014` and any other bare `ADD COLUMN`.
2. **`sigil/relay/v1/accept-envelope.federation-queue.test.mjs:74`** — pg `23514`
   `peer_relays_trust_mode_check` violated by
   `repository.upsertPeer({ ..., trustMode: 'pinned' })`. `016_peer_relays.sql`
   is `CHECK (trust_mode IN ('tofu', 'static'))`; no migration adds `'pinned'`.
   No production code writes `'pinned'` (`cmdRoute` only reads
   `getPeerByDomain`; its "Pinned: yes/no" just means a row exists). Fix in the
   test: `trustMode: 'static'` — matches every other peer-registration call site.

Both other pre-existing pg-log constraint violations seen in the Unit step are
deliberate negative tests (that step is green) — ignore.

## Still open (unchanged from prior wrap)
- **I1 (parked, load-bearing):** sync-mode `forward` branch in
  `accept-envelope.mjs` runs `postForward` (5s timeout) inside
  `repository.withTransaction` though nothing is written locally — slow peer ties
  up a PG connection. Sync mode not production-ready under slow peers; queue mode
  unaffected. Lifting it means restructuring shared `decideRoute`/replay-check
  ordering the `local` path also uses. Own spec slice.
- Doc debt: plan checkboxes untouched; spec needs I1-PARKED + I4
  `MAX_ATTEMPTS=4` notes.
- 6 backlog minors: self-federation reject has no audit event; claim/retry no
  `updated_at` bump; `enqueueFederationForward` timestamps from caller; lease-
  steal double-increments `attempt_count`; no `https:` allowlist on
  `peer.relayUrl`; no prune for terminal `forwarded` `federation_outbox` rows.

## Next session
Fix the 2 suites → push → confirm CI green → I1 → doc debt → sub-project #4
(cross-federation directory/presence).

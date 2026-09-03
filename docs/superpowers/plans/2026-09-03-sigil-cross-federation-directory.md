# Sigil cross-federation directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a relay-forwarded invite-code on-ramp that writes a cross-domain `federation_directory_links` row on both participating relays, and make an active such row a second way to pass sub-project #3's `acceptFederatedEnvelope` step 8 (the directory gate).

**Architecture:** An issuer relay mints a self-describing invite code `sigil-fed-invite:<issuer-domain>:<link-ref>:<base64url-secret>` and stores only `sha256(secret)`. The redeeming human redeems on their own relay; that relay writes its half of the link and enqueues a redemption onto #3's `federation_outbox` (extended with a `kind` discriminator). #3's federation reaper drains it to a new relay-authenticated route on the issuer relay, which writes its half. Each human's own confirmation is set by an authenticated human session on that human's own relay; the other side's confirmation arrives as a signed relay-to-relay message. A link row is `active` only when it holds both confirmations. Step 8 of `acceptFederatedEnvelope` gains a second-pass condition: after the same-owner exemption (checked first, unchanged), an active `federation_directory_links` row on the receiving relay linking the relay-attested `sender_owner_id` to the local recipient's `owner_id` also permits delivery.

**Tech Stack:** Node.js ESM (`.mjs`), `node:crypto` Ed25519, `node:test` + `node:assert/strict`, PostgreSQL 13+ (raw `pg`, no ORM), JCS canonicalization (`sigil/relay/v1/jcs.mjs`). No new dependencies.

**Spec:** `C:\dev\docs\superpowers\specs\2026-09-02-sigil-cross-federation-directory-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- **Repository root:** all paths are under `C:\dev\sigil-repo`. Run the mandatory repo-context preflight before any read/write/test/commit: `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`.
- **CRLF discipline:** files in this repo are CRLF. Use `sed -i` for token edits; never let Edit/Write rewrite a whole file to LF. Verify `git diff --stat` before staging — a multi-hundred-line diff on a file you touched two lines in means the line endings flipped; revert and redo with `sed`.
- **Postgres-only feature.** Cross-federation directory requires a Postgres relay on both ends. An in-memory / `sync`-only relay keeps local first-contact and #3 same-owner federation but not this feature. The limitation is asserted when a `sigil federation invite` / `link` command is invoked without `--database-url` / `SIGIL_DATABASE_URL`, and the three HTTP routes return `501 FEDERATION_DIRECTORY_UNAVAILABLE` on a non-Postgres relay — before any body parse or signature work.
- **New migration is `018_federation_directory.sql`.** Highest existing is `017_federation_outbox.sql`. Migrations are plain `.sql` in `sigil/migrations/`, applied by `sigil/scripts/apply-migrations.mjs` in filename order, and must be re-runnable (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT`).
- **No change to #3's envelope wire format, `.well-known/sigil`, or the `sigil peer` surface.** This spec adds routes and tables and consumes #2 (`getPeerByDomain`) and #3 (`federation_outbox`, reaper, relay-signature auth) output as-is.
- **Relay-signature auth model (from #3):** `Sigil-Relay-Signature` = base64url Ed25519 over the JCS-canonicalized request body; `Sigil-Relay-Key-Id` names the signing key. The receiver re-canonicalizes the parsed body and verifies against those bytes — it never trusts received byte order. The acting relay's identity comes from **which pinned key signed the request**, never from a body field.
- **Timestamps in wire bodies (`requested_at` / `confirmed_at` / `revoked_at`) are audit metadata only.** No handler branches on them. The receiver's own `now` is authoritative for every stored `*_at` column and every freshness/expiry evaluation. Message freshness/replay is structural: `link_ref` is minted once per invite and is `unique`.
- **Generic redemption error.** Redemption failures (unknown / expired / revoked / already-redeemed-by-another / `peer_domain`-mismatch) all return one `403 INVALID_FEDERATION_INVITE` — no oracle. The owner-pair collision case is the sole exception: `409 FEDERATION_LINK_EXISTS` (both parties already authenticated, no enumeration concern).
- **Forward-only enforcement.** Revocation never retroactively invalidates delivered mail; it rejects queued and future envelopes at their next delivery or accept.
- **Every audit event carries `peer_domain` and `link_ref`; none carries an envelope body.**
- **New error codes:** `INVALID_FEDERATION_INVITE` (403), `FEDERATION_LINK_NOT_FOUND` (404), `FEDERATION_LINK_EXISTS` (409, carries `existing_link_ref`), `FEDERATION_DIRECTORY_UNAVAILABLE` (501). Reused from #3 unchanged: `INVALID_FEDERATION_REQUEST` (400), `PEER_NOT_TRUSTED` (403), `RELAY_SIGNATURE_INVALID` (401), `DIRECTORY_LINK_REQUIRED` (403), `FORWARD_TRANSPORT_FAILED`, `RATE_LIMITED` / `QUOTA_EXCEEDED`.
- **Commit discipline:** one commit per task (or per step where the task says so). Conventional Commits. `feat(relay):` / `feat(cli):` / `test(relay):` prefixes. End every commit message with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `sigil/migrations/018_federation_directory.sql` | `federation_directory_invites` table, `federation_directory_links` table, `federation_outbox` `kind` + `directory_payload` columns and relaxed NOT NULLs, `quota_usage_scope_kind_check` extended with the three new scopes. |
| `sigil/relay/v1/federation-relay-auth.mjs` | `verifyInboundRelayRequest(rawBody, headers, { getPeerByKid })` — the shared inbound relay-signature verifier, resolving the acting relay from the signing `kid`. Consumed by both `acceptFederatedEnvelope` and the three directory route handlers. |
| `sigil/relay/v1/federation-relay-auth.test.mjs` | Unit tests for the verifier. |
| `sigil/relay/v1/federation-directory-client.mjs` | Origin-side pure builders (`buildRedemptionRequest`, `buildConfirmationRequest`, `buildRevocationRequest`), `signRelayRequest`, and the one I/O function `postDirectory`. `postForward` / `signForwardRequest` become thin re-exports here or stay in `federation-router.mjs` delegating — see Task 5. |
| `sigil/relay/v1/federation-directory-client.test.mjs` | Unit tests for the builders and `postDirectory`. |
| `sigil/relay/v1/accept-federation-directory.mjs` | The three inbound handlers: `acceptDirectoryRedemption`, `acceptDirectoryConfirmation`, `acceptDirectoryRevocation`. Each runs on one client/transaction, mirrors `acceptWithRepository`'s shape, returns `{ status, body: { request_id, code, message, details } }`. |
| `sigil/relay/v1/accept-federation-directory.test.mjs` | Unit tests against `createMemoryRepository`. |
| `sigil/relay/v1/postgres-repository.directory-federation.test.mjs` | Live-DB tests for the new Postgres repository methods and migration `018` (skipped without `SIGIL_TEST_DATABASE_URL`, mirroring `postgres-repository.federation-outbox.test.mjs`). |
| `sigil/cli/sigil-federation-directory.test.mjs` | CLI tests for `sigil federation invite` / `link` (live-DB, skipped without a connection string, mirroring `sigil-federation-outbox.test.mjs`). |

### Modified files

| Path | Change |
|---|---|
| `sigil/relay/v1/federation-router.mjs` | `signForwardRequest` gains an exported alias `signRelayRequest`; `postForward` is refactored to delegate to `postDirectory` with `path = '/v1/federation/envelopes'` (or `postDirectory` is imported from the new client module). No behaviour change. |
| `sigil/relay/v1/accept-federated-envelope.mjs` | Steps 1–3 (structural parse, origin-pinned, relay signature) delegate to `verifyInboundRelayRequest`; the peer is now resolved by `kid`, then the handler asserts `parsedBody.origin_domain === originDomain`. Step 8 gains the active-link second pass. |
| `sigil/relay/v1/federation-reaper.mjs` | Dispatch on `row.kind`: `envelope` → existing `postForward` path; `directory_*` → build the signed request from `row.directoryPayload` and `postDirectory` to the matching path. On a terminal non-`forwarded` state for a `directory_redemption` row, call `markFederationDirectoryLinkExpired` on the redeemer relay. |
| `sigil/relay/v1/postgres-repository.mjs` | `getPeerByKid`; the seven invite methods; the nine link methods; `enqueueFederationForward` extended to accept a `kind` / `directoryPayload` row; `claimDueFederationForwards` / row mapping surface `kind` + `directory_payload`. |
| `sigil/cli/memory-repository.mjs` | `getPeerByKid`; the local-half invite + link methods (create, get-by-ref, confirm CAS, revoke, mark-expired, list, get-active) with Postgres parity of return shapes. No `enqueueFederationForward` (Postgres-only). |
| `sigil/relay/v1/http-server.mjs` | Three new routes under `/v1/federation/directory/` with the 501 pre-gate, sitting beside the existing `/v1/federation/envelopes` route (before the `authenticateRequest` gate). |
| `sigil/cli/sigil.mjs` | `cmdFederation` grows `invite` and `link` subgroups beside `outbox`; `cmdRoute` gains one advisory line; `usage()` text updated. |

---

## Task 1: Migration `018_federation_directory.sql`

**Files:**
- Create: `sigil/migrations/018_federation_directory.sql`
- Test: `sigil/relay/v1/postgres-repository.directory-federation.test.mjs` (migration-apply case only in this task)

**Interfaces:**
- Consumes: `federation_outbox` and `quota_usage` as created by `017_federation_outbox.sql`.
- Produces: tables `federation_directory_invites`, `federation_directory_links`; columns `federation_outbox.kind`, `federation_outbox.directory_payload`; extended `quota_usage_scope_kind_check`.

- [ ] **Step 1: Write the failing test**

Add to `sigil/relay/v1/postgres-repository.directory-federation.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { applyMigrations } from '../../scripts/apply-migrations.mjs';

const connectionString = process.env.SIGIL_TEST_DATABASE_URL;

test('018 applies clean and creates the directory tables + outbox kind column', { skip: !connectionString }, async (t) => {
  const pool = new pg.Pool({ connectionString });
  t.after(() => pool.end());
  await applyMigrations(connectionString);
  await applyMigrations(connectionString); // re-run must be a no-op

  const invites = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'federation_directory_invites'`);
  assert.ok(invites.rows.some((r) => r.column_name === 'link_ref'));
  assert.ok(invites.rows.some((r) => r.column_name === 'code_hash'));

  const links = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'federation_directory_links'`);
  assert.ok(links.rows.some((r) => r.column_name === 'local_confirmed_at'));
  assert.ok(links.rows.some((r) => r.column_name === 'remote_confirmed_at'));

  const outboxKind = await pool.query(`SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name = 'federation_outbox' AND column_name = 'kind'`);
  assert.equal(outboxKind.rows[0].is_nullable, 'NO');
  assert.match(outboxKind.rows[0].column_default, /'envelope'/);

  const envNullable = await pool.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'federation_outbox' AND column_name = 'envelope'`);
  assert.equal(envNullable.rows[0].is_nullable, 'YES');

  await pool.query(`INSERT INTO federation_directory_links
    (id, link_ref, local_owner_id, local_endpoint_id, remote_owner_id, remote_endpoint_id, remote_domain, role, status, peer_domain, created_at, updated_at)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'usr_a@a.example', 'ep_a@a.example', 'usr_b@b.example', 'ep_b@b.example', 'b.example', 'issuer', 'pending', 'b.example', now(), now())`);
  await assert.rejects(
    pool.query(`INSERT INTO federation_directory_links
      (id, link_ref, local_owner_id, local_endpoint_id, remote_owner_id, remote_endpoint_id, remote_domain, role, status, peer_domain, created_at, updated_at)
      VALUES (gen_random_uuid(), gen_random_uuid(), 'usr_a@a.example', 'ep_a2@a.example', 'usr_b@b.example', 'ep_b2@b.example', 'b.example', 'issuer', 'active', 'b.example', now(), now())`),
    /unique|duplicate key/i,
  );
  await pool.query(`DELETE FROM federation_directory_links WHERE local_owner_id = 'usr_a@a.example'`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SIGIL_TEST_DATABASE_URL=<dsn> node --test sigil/relay/v1/postgres-repository.directory-federation.test.mjs`
Expected: FAIL — `relation "federation_directory_invites" does not exist`. With no local test DB, defer verification to the Task 17 live-DB matrix; still author the migration exactly as below.

- [ ] **Step 3: Write the migration**

Create `sigil/migrations/018_federation_directory.sql` (CRLF line endings — match `017_federation_outbox.sql`):

```sql
-- sigil/migrations/018_federation_directory.sql
-- Sub-project #4 (cross-federation directory) -- design
-- docs/superpowers/specs/2026-09-02-sigil-cross-federation-directory-design.md.
-- Requires PostgreSQL 13+ (gen_random_uuid() core builtin), same floor as 017.

CREATE TABLE IF NOT EXISTS federation_directory_invites (
  invite_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_ref                 UUID NOT NULL UNIQUE,
  issuer_endpoint_id       TEXT NOT NULL,
  issuer_owner_id          TEXT NOT NULL,
  peer_domain              TEXT NOT NULL,
  code_hash                TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'redeemed', 'expired', 'revoked')),
  redeemed_by_owner_id     TEXT,
  redeemed_by_endpoint_id  TEXT,
  redeemed_at              TIMESTAMPTZ,
  expires_at               TIMESTAMPTZ NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS federation_directory_invites_peer_codehash_uidx
  ON federation_directory_invites (peer_domain, code_hash);
CREATE INDEX IF NOT EXISTS federation_directory_invites_status_expiry_idx
  ON federation_directory_invites (status, expires_at);

CREATE TABLE IF NOT EXISTS federation_directory_links (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_ref             UUID NOT NULL UNIQUE,
  local_owner_id       TEXT NOT NULL,
  local_endpoint_id    TEXT NOT NULL,
  remote_owner_id      TEXT NOT NULL,
  remote_endpoint_id   TEXT NOT NULL,
  remote_domain        TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('issuer', 'redeemer')),
  initiated_via        TEXT NOT NULL DEFAULT 'invite'
                         CHECK (initiated_via IN ('invite', 'oidc_match')),
  status               TEXT NOT NULL
                         CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  local_confirmed_at   TIMESTAMPTZ,
  remote_confirmed_at  TIMESTAMPTZ,
  source_invite_id     UUID,
  peer_domain          TEXT NOT NULL,
  revoked_at           TIMESTAMPTZ,
  revoked_by           TEXT CHECK (revoked_by IN ('local', 'remote')),
  last_reason_code     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT federation_directory_links_distinct_owners
    CHECK (local_owner_id <> remote_owner_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS federation_directory_links_live_pair_uidx
  ON federation_directory_links (local_owner_id, remote_owner_id, remote_domain)
  WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS federation_directory_links_step8_idx
  ON federation_directory_links (status, local_owner_id, remote_owner_id, remote_domain);

ALTER TABLE federation_outbox
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'envelope';
ALTER TABLE federation_outbox
  ADD COLUMN IF NOT EXISTS directory_payload JSONB;

ALTER TABLE federation_outbox DROP CONSTRAINT IF EXISTS federation_outbox_kind_check;
ALTER TABLE federation_outbox ADD CONSTRAINT federation_outbox_kind_check
  CHECK (kind IN ('envelope', 'directory_redemption', 'directory_confirmation', 'directory_revocation'));

ALTER TABLE federation_outbox ALTER COLUMN envelope        DROP NOT NULL;
ALTER TABLE federation_outbox ALTER COLUMN sender_key      DROP NOT NULL;
ALTER TABLE federation_outbox ALTER COLUMN sender_owner_id DROP NOT NULL;

ALTER TABLE federation_outbox DROP CONSTRAINT IF EXISTS federation_outbox_envelope_present_check;
ALTER TABLE federation_outbox ADD CONSTRAINT federation_outbox_envelope_present_check
  CHECK (kind <> 'envelope' OR envelope IS NOT NULL);
ALTER TABLE federation_outbox DROP CONSTRAINT IF EXISTS federation_outbox_sender_key_present_check;
ALTER TABLE federation_outbox ADD CONSTRAINT federation_outbox_sender_key_present_check
  CHECK (kind <> 'envelope' OR sender_key IS NOT NULL);
ALTER TABLE federation_outbox DROP CONSTRAINT IF EXISTS federation_outbox_sender_owner_present_check;
ALTER TABLE federation_outbox ADD CONSTRAINT federation_outbox_sender_owner_present_check
  CHECK (kind <> 'envelope' OR sender_owner_id IS NOT NULL);
ALTER TABLE federation_outbox DROP CONSTRAINT IF EXISTS federation_outbox_directory_payload_present_check;
ALTER TABLE federation_outbox ADD CONSTRAINT federation_outbox_directory_payload_present_check
  CHECK (kind = 'envelope' OR directory_payload IS NOT NULL);

ALTER TABLE quota_usage DROP CONSTRAINT IF EXISTS quota_usage_scope_kind_check;
ALTER TABLE quota_usage ADD CONSTRAINT quota_usage_scope_kind_check
  CHECK (scope_kind IN ('endpoint', 'owner', 'conversation',
                        'directory_invite_create', 'directory_invite_redeem',
                        'directory_match_create', 'directory_match_attempt',
                        'federation_origin',
                        'federation_directory_invite_create',
                        'federation_directory_redeem',
                        'federation_directory_redemption_inbound'));
```

Verify the base scope list in Step "quota_usage" matches `017_federation_outbox.sql`'s current constraint exactly before adding the three new values — copy 017's list verbatim, then append.

- [ ] **Step 4: Run test to verify it passes**

Run: `SIGIL_TEST_DATABASE_URL=<dsn> node --test sigil/relay/v1/postgres-repository.directory-federation.test.mjs`
Expected: PASS (or deferred to Task 17).

- [ ] **Step 5: Commit**

```
git add sigil/migrations/018_federation_directory.sql sigil/relay/v1/postgres-repository.directory-federation.test.mjs
git commit -m "feat(relay): migration 018 for cross-federation directory tables"
```
(append the `Co-Authored-By:` trailer)

---

## Task 2: `getPeerByKid` reverse index on both repositories

**Files:**
- Modify: `sigil/relay/v1/postgres-repository.mjs` (add `getPeerByKid` next to `getPeerByDomain`)
- Modify: `sigil/cli/memory-repository.mjs` (add `getPeerByKid` next to `getPeerByDomain`, ~line 323)
- Test: `sigil/cli/memory-repository.peer.test.mjs`, `sigil/relay/v1/postgres-repository.peer.test.mjs`

**Interfaces:**
- Consumes: the pinned-peer store from #2 — `getPeerByDomain(domain)` returns `{ domain, relayUrl, keys: [{ kid, alg, publicKey }], ... }`.
- Produces: `getPeerByKid(kid, client?)` → the same record shape as `getPeerByDomain`, matched on any `keys[].kid`, else `null`. Consumed by `verifyInboundRelayRequest` (Task 3).

- [ ] **Step 1: Write the failing test (memory repo)**

Add to `sigil/cli/memory-repository.peer.test.mjs` (match the peer-insert call the existing tests use — `upsertPeer` / `pinPeer` / `addPeer`):

```js
test('getPeerByKid resolves the pinned peer that published a kid', async () => {
  const repo = createMemoryRepository();
  await repo.upsertPeer({
    domain: 'b.example',
    relayUrl: 'https://relay.b.example',
    keys: [{ kid: 'kid-b-1', alg: 'Ed25519', publicKey: 'AAAA' }],
  });
  assert.equal((await repo.getPeerByKid('kid-b-1'))?.domain, 'b.example');
  assert.equal(await repo.getPeerByKid('kid-unknown'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/cli/memory-repository.peer.test.mjs`
Expected: FAIL — `repo.getPeerByKid is not a function`.

- [ ] **Step 3: Implement in the memory repo**

Immediately after `getPeerByDomain` in `sigil/cli/memory-repository.mjs` (match the container name that method uses):

```js
    async getPeerByKid(kid) {
      for (const peer of peers.values()) {
        if ((peer.keys ?? []).some((k) => k.kid === kid)) return peer;
      }
      return null;
    },
```

- [ ] **Step 4: Implement in the Postgres repo**

Check `sigil/migrations/016_peer_relays.sql` first for where keys live. If a `jsonb` `keys` column on `peer_relays`, add after `getPeerByDomain` in `sigil/relay/v1/postgres-repository.mjs`:

```js
  async getPeerByKid(kid, client = this.pool) {
    const result = await client.query(
      `SELECT * FROM peer_relays
        WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(keys) AS k WHERE k->>'kid' = $1)
        LIMIT 1`,
      [kid],
    );
    return result.rows[0] ? rowToPeerRecord(result.rows[0]) : null;
  }
```

If keys are a child table (`peer_relay_keys`): `SELECT p.* FROM peer_relays p JOIN peer_relay_keys k ON k.peer_id = p.id WHERE k.kid = $1 LIMIT 1`. Reuse the exact row-mapping helper `getPeerByDomain` uses.

- [ ] **Step 5: Write + run the Postgres mirror test**

Add the same assertions to `sigil/relay/v1/postgres-repository.peer.test.mjs` (skipped without `SIGIL_TEST_DATABASE_URL`).
Run: `node --test sigil/cli/memory-repository.peer.test.mjs` → PASS. Postgres case deferred to Task 17 if no local DB.

- [ ] **Step 6: Commit**

```
git add sigil/relay/v1/postgres-repository.mjs sigil/cli/memory-repository.mjs sigil/cli/memory-repository.peer.test.mjs sigil/relay/v1/postgres-repository.peer.test.mjs
git commit -m "feat(relay): add getPeerByKid reverse index to both repositories"
```

---

## Task 3: `federation-relay-auth.mjs` — shared inbound relay-signature verifier

**Files:**
- Create: `sigil/relay/v1/federation-relay-auth.mjs`
- Create: `sigil/relay/v1/federation-relay-auth.test.mjs`

**Interfaces:**
- Consumes: `getPeerByKid(kid)` (Task 2); `canonicalJsonBytes` from `./jcs.mjs`; `node:crypto`.
- Produces: `verifyInboundRelayRequest(rawBody, headers, { getPeerByKid })` → `Promise<{ ok: true, originDomain, peerRecord, parsedBody }>` or throws `Object.assign(new Error(msg), { code, httpStatus })`. Codes/status: `INVALID_FEDERATION_REQUEST`/400, `RELAY_SIGNATURE_INVALID`/401, `PEER_NOT_TRUSTED`/403. Consumed by Task 4 (`acceptFederatedEnvelope` steps 1–3) and Task 10 (the three directory routes).

- [ ] **Step 1: Write the failing test**

Create `sigil/relay/v1/federation-relay-auth.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canonicalJsonBytes } from './jcs.mjs';
import { verifyInboundRelayRequest } from './federation-relay-auth.mjs';

function makePeer() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
  const kid = 'kid-b-1';
  const peer = { domain: 'b.example', relayUrl: 'https://relay.b.example', keys: [{ kid, alg: 'Ed25519', publicKey: spki }] };
  return { peer, privateKey, kid };
}
function sign(privateKey, bytes) { return crypto.sign(null, bytes, privateKey).toString('base64url'); }

test('a valid signed request passes and reports originDomain from the kid', async () => {
  const { peer, privateKey, kid } = makePeer();
  const body = { link_ref: '11111111-1111-1111-1111-111111111111', confirmed_at: '2026-09-02T00:00:00.000Z' };
  const raw = Buffer.from(JSON.stringify(body));
  const headers = { 'sigil-relay-signature': sign(privateKey, canonicalJsonBytes(body)), 'sigil-relay-key-id': kid };
  const getPeerByKid = async (k) => (k === kid ? peer : null);
  const res = await verifyInboundRelayRequest(raw, headers, { getPeerByKid });
  assert.equal(res.ok, true);
  assert.equal(res.originDomain, 'b.example');
  assert.deepEqual(res.parsedBody, body);
});

test('malformed JSON body -> 400 INVALID_FEDERATION_REQUEST', async () => {
  await assert.rejects(
    verifyInboundRelayRequest(Buffer.from('{not json'), { 'sigil-relay-key-id': 'x' }, { getPeerByKid: async () => null }),
    (e) => e.code === 'INVALID_FEDERATION_REQUEST' && e.httpStatus === 400,
  );
});

test('absent Sigil-Relay-Key-Id -> 401 RELAY_SIGNATURE_INVALID', async () => {
  await assert.rejects(
    verifyInboundRelayRequest(Buffer.from('{}'), {}, { getPeerByKid: async () => null }),
    (e) => e.code === 'RELAY_SIGNATURE_INVALID' && e.httpStatus === 401,
  );
});

test('kid names no pinned peer -> 403 PEER_NOT_TRUSTED', async () => {
  await assert.rejects(
    verifyInboundRelayRequest(Buffer.from('{}'), { 'sigil-relay-key-id': 'nope', 'sigil-relay-signature': 'x' }, { getPeerByKid: async () => null }),
    (e) => e.code === 'PEER_NOT_TRUSTED' && e.httpStatus === 403,
  );
});

test('tampered body fails signature -> 401', async () => {
  const { peer, privateKey, kid } = makePeer();
  const signed = { link_ref: 'a', confirmed_at: 'b' };
  const headers = { 'sigil-relay-signature': sign(privateKey, canonicalJsonBytes(signed)), 'sigil-relay-key-id': kid };
  const tampered = Buffer.from(JSON.stringify({ link_ref: 'a', confirmed_at: 'DIFFERENT' }));
  await assert.rejects(
    verifyInboundRelayRequest(tampered, headers, { getPeerByKid: async () => peer }),
    (e) => e.code === 'RELAY_SIGNATURE_INVALID',
  );
});

test('kid reused with a swapped publicKey fails closed', async () => {
  const { peer, kid } = makePeer();
  const other = crypto.generateKeyPairSync('ed25519');
  const body = { link_ref: 'a' };
  const headers = { 'sigil-relay-signature': sign(other.privateKey, canonicalJsonBytes(body)), 'sigil-relay-key-id': kid };
  await assert.rejects(
    verifyInboundRelayRequest(Buffer.from(JSON.stringify(body)), headers, { getPeerByKid: async () => peer }),
    (e) => e.code === 'RELAY_SIGNATURE_INVALID',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/relay/v1/federation-relay-auth.test.mjs`
Expected: FAIL — cannot import `verifyInboundRelayRequest`.

- [ ] **Step 3: Write the implementation**

Create `sigil/relay/v1/federation-relay-auth.mjs`:

```js
import crypto from 'node:crypto';
import { canonicalJsonBytes } from './jcs.mjs';

function fail(code, httpStatus, message) {
  return Object.assign(new Error(message), { code, httpStatus });
}

// Shared inbound relay-signature verification (design "New module:
// federation-relay-auth.mjs"). The acting relay's identity comes from WHICH
// pinned key signed the request -- never a body field -- so bodies that carry
// no domain (confirmation, revocation) authenticate exactly like redemption.
export async function verifyInboundRelayRequest(rawBody, headers, { getPeerByKid } = {}) {
  // 1. Parse.
  let parsedBody;
  try {
    parsedBody = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) throw new Error('not an object');
  } catch {
    throw fail('INVALID_FEDERATION_REQUEST', 400, 'Request body is not a JSON object');
  }

  // 2. Resolve the acting relay from the signing kid.
  const kid = headers['sigil-relay-key-id'];
  const signature = headers['sigil-relay-signature'];
  if (typeof kid !== 'string' || kid.length === 0) {
    throw fail('RELAY_SIGNATURE_INVALID', 401, 'Sigil-Relay-Key-Id header is required');
  }
  const peerRecord = await getPeerByKid(kid);
  if (!peerRecord) {
    throw fail('PEER_NOT_TRUSTED', 403, 'No pinned peer relay published the signing key id');
  }

  // 3. Verify the signature over re-canonicalized bytes. kid and publicKey must
  //    belong to the same pinned key entry.
  const entry = (peerRecord.keys ?? []).find((k) => k.kid === kid);
  let verified = false;
  if (entry && typeof signature === 'string' && signature.length > 0) {
    try {
      const pub = crypto.createPublicKey({ key: Buffer.from(entry.publicKey, 'base64url'), format: 'der', type: 'spki' });
      verified = crypto.verify(null, canonicalJsonBytes(parsedBody), pub, Buffer.from(signature, 'base64url'));
    } catch {
      verified = false;
    }
  }
  if (!verified) {
    throw fail('RELAY_SIGNATURE_INVALID', 401, 'Sigil-Relay-Signature failed verification against the pinned peer key');
  }

  // 4. Return. Each handler asserts its own body/row consistency against originDomain.
  return { ok: true, originDomain: peerRecord.domain, peerRecord, parsedBody };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sigil/relay/v1/federation-relay-auth.test.mjs`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```
git add sigil/relay/v1/federation-relay-auth.mjs sigil/relay/v1/federation-relay-auth.test.mjs
git commit -m "feat(relay): shared inbound relay-signature verifier keyed by signing kid"
```

---

## Task 4: Refactor `acceptFederatedEnvelope` steps 1–3 onto the shared verifier

**Files:**
- Modify: `sigil/relay/v1/accept-federated-envelope.mjs:36-65` (structural checks 1, relay-signature check 3; the peer lookup moves from `getPeerByDomain(originDomain)` to `getPeerByKid`)
- Test: `sigil/relay/v1/federation-regression.test.mjs` (add one case), `sigil/relay/v1/accept-federated-envelope.test.mjs`

**Interfaces:**
- Consumes: `verifyInboundRelayRequest` (Task 3), `getPeerByKid` (Task 2). The HTTP route (`http-server.mjs:158-176`) already reads the raw body and parses it — pass the raw bytes through so the verifier re-parses/re-canonicalizes from the same source (add `rawBody` to the options `acceptFederatedEnvelope` receives, or have it re-`JSON.stringify(body)` — prefer threading `rawBody`).
- Produces: unchanged external behaviour for a well-formed request. New behaviour: a request whose `origin_domain` body field disagrees with the `kid`'s pinned domain → `403 PEER_NOT_TRUSTED`.

- [ ] **Step 1: Write the failing test**

Add to `sigil/relay/v1/federation-regression.test.mjs`:

```js
test('federated envelope: origin_domain body field disagreeing with the signing kid -> 403 PEER_NOT_TRUSTED', async () => {
  // Build a well-formed, correctly-signed forward request from peer b.example,
  // then mutate ONLY the body's origin_domain to "c.example" (a domain that is
  // also pinned, or any other value) and re-sign is NOT done -- the point is the
  // kid resolves to b.example while the body claims c.example.
  const { repository, peerB, signAs } = await seedFederatedInboundFixture();
  const body = buildValidForwardBody({ originDomain: 'b.example' });
  body.origin_domain = 'c.example';
  const raw = Buffer.from(JSON.stringify(body));
  const headers = { 'sigil-relay-signature': signAs(peerB, raw), 'sigil-relay-key-id': peerB.kid };
  const res = await acceptFederatedEnvelope(body, headers, { repository, rawBody: raw, relayDomain: 'a.example', now: new Date() });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'PEER_NOT_TRUSTED');
});
```

Use the file's existing fixture helpers; if none exist with these names, model the fixture on the current first test in `accept-federated-envelope.test.mjs` (seed a pinned peer, sign a forward body, call `acceptFederatedEnvelope`).

- [ ] **Step 2: Run the full #3 federation suite to capture the green baseline**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs sigil/relay/v1/federation-regression.test.mjs sigil/relay/v1/http-server.federation-inbound.test.mjs`
Expected: the new case FAILS (`origin_domain` mismatch currently is not checked — check 2 does `getPeerByDomain('c.example')` which, if `c.example` is pinned, passes); every other case PASSES. Record the pass count.

- [ ] **Step 3: Refactor checks 1–3**

In `sigil/relay/v1/accept-federated-envelope.mjs`:

1. Add the import: `import { verifyInboundRelayRequest } from './federation-relay-auth.mjs';`
2. Replace the body of checks 1–3 (lines ~36–65) with a call to the verifier, then keep every check from 4 onward unchanged:

```js
  // --- Checks 1-3: structural parse + origin pinned + relay signature ---
  let originDomain, peer, parsedBody;
  try {
    ({ originDomain, peerRecord: peer, parsedBody } = await verifyInboundRelayRequest(
      options.rawBody ?? Buffer.from(JSON.stringify(body)),
      headers,
      { getPeerByKid: (kid) => repository.getPeerByKid(kid) },
    ));
  } catch (error) {
    await auditInboundReject(error.code);
    return respond(error.httpStatus ?? 400, error.code ?? 'INVALID_FEDERATION_REQUEST', error.message, options);
  }
  const { envelope, sender_key: senderKey, sender_owner_id: senderOwnerId } = parsedBody;

  // Body/origin consistency: the body's declared origin_domain must equal the
  // domain the signing kid is pinned under (design: "asserting parsedBody
  // .origin_domain === originDomain in the handler").
  if (!parsedBody.origin_domain || String(parsedBody.origin_domain).toLowerCase() !== originDomain.toLowerCase()) {
    await auditInboundReject('PEER_NOT_TRUSTED');
    return respond(403, 'PEER_NOT_TRUSTED', 'Body origin_domain does not match the signing relay key', options, { origin_domain: parsedBody.origin_domain, signing_domain: originDomain });
  }

  // Self-federation guard (unchanged from #3): a peer must never assert this
  // relay's own domain as the origin.
  if (isNonEmptyString(options.relayDomain) && originDomain.toLowerCase() === options.relayDomain.toLowerCase()) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'origin_domain equals this relay\'s own domain (self-federation is not allowed)', options, { origin_domain: originDomain });
  }
  // structural checks on envelope / sender_key / sender_owner_id (unchanged from #3):
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return respond(400, 'INVALID_FEDERATION_REQUEST', 'envelope must be an object', options);
  if (!senderKey || !isNonEmptyString(senderKey.kid) || senderKey.alg !== 'Ed25519' || !isNonEmptyString(senderKey.publicKey)) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'sender_key must be { kid, alg: "Ed25519", publicKey }', options);
  }
  try { parseFederatedId(senderOwnerId); } catch { return respond(400, 'INVALID_FEDERATION_REQUEST', 'sender_owner_id is not a well-formed federated id', options); }
```

3. Delete the now-superseded old check 2 (`repository.getPeerByDomain(originDomain)`) and old check 3 (`verifyRelaySignature(...)`). Keep checks 4, 5, and 6–10 exactly as they are (they reference `envelope`, `senderKey`, `senderOwnerId`, `originDomain`, `peer` — all still bound).
4. Thread `rawBody` in from the HTTP route: in `sigil/relay/v1/http-server.mjs:167`, add `rawBody: Buffer.from(raw)` to the options object passed to `acceptFederatedEnvelope` (the route already has `raw` from `readBody`).

- [ ] **Step 4: Run the full suite to verify green + the new case passes**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs sigil/relay/v1/accept-federated-envelope.pg.test.mjs sigil/relay/v1/federation-regression.test.mjs sigil/relay/v1/http-server.federation-inbound.test.mjs`
Expected: the pass count from Step 2 is preserved, plus the new `PEER_NOT_TRUSTED` case now PASSES.

- [ ] **Step 5: Commit**

```
git add sigil/relay/v1/accept-federated-envelope.mjs sigil/relay/v1/http-server.mjs sigil/relay/v1/federation-regression.test.mjs
git commit -m "refactor(relay): acceptFederatedEnvelope steps 1-3 use the shared relay-auth verifier"
```

---

## Task 5: `federation-directory-client.mjs` — origin-side builders + `postDirectory`

**Files:**
- Create: `sigil/relay/v1/federation-directory-client.mjs`
- Create: `sigil/relay/v1/federation-directory-client.test.mjs`
- Modify: `sigil/relay/v1/federation-router.mjs` (export `signRelayRequest` alias; refactor `postForward` to delegate to `postDirectory`)

**Interfaces:**
- Consumes: `canonicalJsonBytes` from `./jcs.mjs`; `node:crypto`; #3's `identity` shape `{ private_key_pem, key_id }`.
- Produces:
  - `buildRedemptionRequest({ linkRef, code, redeemer, redeemerDomain, now })` → `{ body, canonicalBytes }`, `body = { link_ref, code, redeemer: { owner_id, endpoint_id }, redeemer_domain, requested_at }`.
  - `buildConfirmationRequest({ linkRef, now })` → `{ body: { link_ref, confirmed_at }, canonicalBytes }`.
  - `buildRevocationRequest({ linkRef, now })` → `{ body: { link_ref, revoked_at }, canonicalBytes }`.
  - `signRelayRequest(canonicalBytes, identity)` → `{ signature, keyId }` (Ed25519 over `canonicalBytes`).
  - `postDirectory(peer, path, canonicalBytes, { signature, keyId }, { fetchImpl = fetch })` → `Promise<{ ok, status, peerCode? }>`. `path` ∈ `/v1/federation/directory/redemptions` | `/confirmations` | `/revocations`. Same outcome classification as #3's `postForward`: `redirect: 'error'`, `AbortSignal.timeout(5000)`, `Sigil-Relay-Signature` / `Sigil-Relay-Key-Id` / `content-type: application/json`; 2xx → `{ ok: true, status }`; 4xx → `{ ok: false, status, peerCode? }` (`peerCode` only from a ≤ 4 KiB JSON body whose `code` matches `^[A-Z][A-Z0-9_]{0,63}$`); timeout / transport / 5xx → throw with `.code = 'FORWARD_TRANSPORT_FAILED'`. Target is always `new URL(path, peer.relayUrl).toString()`, never a message field.
- Consumed by: the reaper (Task 11), the redemption CLI (Task 13), the confirm/revoke CLI (Tasks 13–14).

- [ ] **Step 1: Write the failing test**

Create `sigil/relay/v1/federation-directory-client.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canonicalJsonBytes } from './jcs.mjs';
import {
  buildRedemptionRequest, buildConfirmationRequest, buildRevocationRequest,
  signRelayRequest, postDirectory,
} from './federation-directory-client.mjs';

const NOW = new Date('2026-09-02T12:00:00.000Z');

test('buildRedemptionRequest: canonicalBytes is both the wire body and the signing input', () => {
  const { body, canonicalBytes } = buildRedemptionRequest({
    linkRef: 'L1', code: 'sigil-fed-invite:a.example:L1:SEG',
    redeemer: { owner_id: 'usr_bob@b.example', endpoint_id: 'ep_c@b.example' },
    redeemerDomain: 'b.example', now: NOW,
  });
  assert.deepEqual(body, {
    link_ref: 'L1', code: 'sigil-fed-invite:a.example:L1:SEG',
    redeemer: { owner_id: 'usr_bob@b.example', endpoint_id: 'ep_c@b.example' },
    redeemer_domain: 'b.example', requested_at: '2026-09-02T12:00:00.000Z',
  });
  assert.deepEqual(canonicalBytes, canonicalJsonBytes(body));
});

test('buildConfirmationRequest / buildRevocationRequest shapes', () => {
  assert.deepEqual(buildConfirmationRequest({ linkRef: 'L1', now: NOW }).body, { link_ref: 'L1', confirmed_at: '2026-09-02T12:00:00.000Z' });
  assert.deepEqual(buildRevocationRequest({ linkRef: 'L1', now: NOW }).body, { link_ref: 'L1', revoked_at: '2026-09-02T12:00:00.000Z' });
});

test('signRelayRequest signs the exact bytes with the identity key', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const identity = { private_key_pem: privateKey.export({ format: 'pem', type: 'pkcs8' }), key_id: 'kid-a-1' };
  const bytes = canonicalJsonBytes({ link_ref: 'L1' });
  const { signature, keyId } = signRelayRequest(bytes, identity);
  assert.equal(keyId, 'kid-a-1');
  assert.equal(crypto.verify(null, bytes, publicKey, Buffer.from(signature, 'base64url')), true);
});

test('postDirectory: targets peer.relayUrl + path, redirect error, 2xx -> ok', async () => {
  let seenUrl, seenOpts;
  const fetchImpl = async (url, opts) => { seenUrl = url; seenOpts = opts; return { status: 202 }; };
  const res = await postDirectory({ relayUrl: 'https://relay.b.example' }, '/v1/federation/directory/redemptions',
    Buffer.from('{}'), { signature: 'sig', keyId: 'kid' }, { fetchImpl });
  assert.equal(seenUrl, 'https://relay.b.example/v1/federation/directory/redemptions');
  assert.equal(seenOpts.redirect, 'error');
  assert.equal(seenOpts.headers['Sigil-Relay-Key-Id'], 'kid');
  assert.deepEqual(res, { ok: true, status: 202 });
});

test('postDirectory: 4xx with a well-formed code -> peerCode; oversize/non-JSON -> omitted', async () => {
  const withCode = async () => ({ status: 403, body: null, text: async () => JSON.stringify({ code: 'INVALID_FEDERATION_INVITE' }) });
  assert.deepEqual(
    await postDirectory({ relayUrl: 'https://r' }, '/v1/federation/directory/redemptions', Buffer.from('{}'), { signature: 's', keyId: 'k' }, { fetchImpl: withCode }),
    { ok: false, status: 403, peerCode: 'INVALID_FEDERATION_INVITE' },
  );
  const junk = async () => ({ status: 400, body: null, text: async () => 'x'.repeat(5000) });
  assert.deepEqual(
    await postDirectory({ relayUrl: 'https://r' }, '/v1/federation/directory/confirmations', Buffer.from('{}'), { signature: 's', keyId: 'k' }, { fetchImpl: junk }),
    { ok: false, status: 400 },
  );
});

test('postDirectory: transport error / 5xx -> throws FORWARD_TRANSPORT_FAILED', async () => {
  await assert.rejects(
    postDirectory({ relayUrl: 'https://r' }, '/v1/federation/directory/revocations', Buffer.from('{}'), { signature: 's', keyId: 'k' }, { fetchImpl: async () => { throw new Error('econnrefused'); } }),
    (e) => e.code === 'FORWARD_TRANSPORT_FAILED',
  );
  await assert.rejects(
    postDirectory({ relayUrl: 'https://r' }, '/v1/federation/directory/revocations', Buffer.from('{}'), { signature: 's', keyId: 'k' }, { fetchImpl: async () => ({ status: 503 }) }),
    (e) => e.code === 'FORWARD_TRANSPORT_FAILED',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/relay/v1/federation-directory-client.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `sigil/relay/v1/federation-directory-client.mjs`. Lift the 4xx body-reading logic from `federation-router.mjs:62-127` verbatim (the streaming read with the 4 KiB cap and the `PEER_CODE_RE` shape check) into a shared `readPeerCode(res)` helper so `postForward` and `postDirectory` share one implementation.

```js
import crypto from 'node:crypto';
import { canonicalJsonBytes } from './jcs.mjs';

const isoOf = (now) => (now instanceof Date ? now : new Date(now)).toISOString();

export function buildRedemptionRequest({ linkRef, code, redeemer, redeemerDomain, now }) {
  const body = {
    link_ref: linkRef,
    code,
    redeemer: { owner_id: redeemer.owner_id, endpoint_id: redeemer.endpoint_id },
    redeemer_domain: redeemerDomain,
    requested_at: isoOf(now),
  };
  return { body, canonicalBytes: canonicalJsonBytes(body) };
}

export function buildConfirmationRequest({ linkRef, now }) {
  const body = { link_ref: linkRef, confirmed_at: isoOf(now) };
  return { body, canonicalBytes: canonicalJsonBytes(body) };
}

export function buildRevocationRequest({ linkRef, now }) {
  const body = { link_ref: linkRef, revoked_at: isoOf(now) };
  return { body, canonicalBytes: canonicalJsonBytes(body) };
}

export function signRelayRequest(canonicalBytes, identity) {
  const privateKey = crypto.createPrivateKey(identity.private_key_pem);
  const signature = crypto.sign(null, canonicalBytes, privateKey).toString('base64url');
  return { signature, keyId: identity.key_id };
}

const PEER_CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const PEER_BODY_READ_CAP = 4 * 1024;

export async function readPeerCode(res) {
  // (verbatim copy of federation-router.mjs's streaming/fallback 4xx read)
  // ... streaming read of res.body capped at PEER_BODY_READ_CAP, else res.text()
  // fallback; returns a string matching PEER_CODE_RE or undefined.
}

const DIRECTORY_PATHS = new Set([
  '/v1/federation/directory/redemptions',
  '/v1/federation/directory/confirmations',
  '/v1/federation/directory/revocations',
  '/v1/federation/envelopes',
]);

export async function postDirectory(peer, path, canonicalBytes, { signature, keyId }, { fetchImpl = fetch } = {}) {
  if (!DIRECTORY_PATHS.has(path)) throw Object.assign(new Error(`postDirectory: unexpected path ${path}`), { code: 'FORWARD_TRANSPORT_FAILED' });
  const url = new URL(path, peer.relayUrl.endsWith('/') ? peer.relayUrl : peer.relayUrl + '/').toString();
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      body: canonicalBytes,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', 'Sigil-Relay-Signature': signature, 'Sigil-Relay-Key-Id': keyId },
    });
  } catch (error) {
    throw Object.assign(new Error(`directory post transport failed: ${error.message}`), { code: 'FORWARD_TRANSPORT_FAILED', cause: error });
  }
  if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
  if (res.status >= 500) throw Object.assign(new Error(`peer relay returned ${res.status}`), { code: 'FORWARD_TRANSPORT_FAILED', status: res.status });
  const peerCode = await readPeerCode(res);
  return peerCode ? { ok: false, status: res.status, peerCode } : { ok: false, status: res.status };
}
```

Note the URL construction: `new URL(path, base)` requires `base` to be an absolute URL and treats `path` as absolute (leading `/`) so it replaces any base path. Verify against the redirect-target test.

- [ ] **Step 4: Refactor `federation-router.mjs` to share**

In `sigil/relay/v1/federation-router.mjs`:
1. `import { postDirectory, readPeerCode } from './federation-directory-client.mjs';`
2. Replace `postForward`'s body with: `return postDirectory(peer, '/v1/federation/envelopes', canonicalBytes, { signature, keyId }, { fetchImpl });`
3. Add `export const signRelayRequest = signForwardRequest;` — keep `signForwardRequest` as the primary name so #3 call sites are untouched; `signRelayRequest` is the alias the new code uses. (Or the reverse — either way both names resolve.)
4. Delete the now-duplicated 4xx streaming-read block from `postForward` (it lives in `readPeerCode` now).

- [ ] **Step 5: Run both suites**

Run: `node --test sigil/relay/v1/federation-directory-client.test.mjs sigil/relay/v1/federation-router.test.mjs sigil/relay/v1/federation-reaper.test.mjs`
Expected: new file PASSES; `federation-router.test.mjs` and `federation-reaper.test.mjs` stay green (the `postForward` refactor is behaviour-preserving).

- [ ] **Step 6: Commit**

```
git add sigil/relay/v1/federation-directory-client.mjs sigil/relay/v1/federation-directory-client.test.mjs sigil/relay/v1/federation-router.mjs
git commit -m "feat(relay): federation directory client (builders + postDirectory), shared with postForward"
```

---

## Task 6: Repository — `federation_directory_invites` methods (both repos)

**Files:**
- Modify: `sigil/relay/v1/postgres-repository.mjs` (invite methods)
- Modify: `sigil/cli/memory-repository.mjs` (invite methods, local-half parity)
- Test: `sigil/relay/v1/accept-federation-directory.test.mjs` (memory-repo coverage lands with Task 8); `sigil/relay/v1/postgres-repository.directory-federation.test.mjs` (Postgres coverage)

**Interfaces:**
- Produces (identical signatures on both repos unless noted):
  - `createFederationDirectoryInvite(row, client)` — `row = { linkRef, issuerEndpointId, issuerOwnerId, peerDomain, codeHash, expiresAt, now }`. Returns `{ invite_id, link_ref }`.
  - `getFederationDirectoryInviteByRef(linkRef, client, { forUpdate = false })` — primary redemption lookup. **Also performs the lazy `pending` → `expired` transition when `expires_at <= now`**, in the same call/txn, before returning. Returns the row (post-transition status) or `null`. Row fields: `invite_id, link_ref, issuer_endpoint_id, issuer_owner_id, peer_domain, code_hash, status, redeemed_by_owner_id, redeemed_by_endpoint_id, redeemed_at, expires_at`.
  - `markFederationDirectoryInviteRedeemed(inviteId, redeemer, now, client)` — `redeemer = { owner_id, endpoint_id }`. Sets `status='redeemed'`, `redeemed_by_*`, `redeemed_at`.
  - `revokeFederationDirectoryInvite(linkRef, now, client)` — `pending` → `revoked`. Returns `{ updated: 0|1 }`; a row already `redeemed` or terminal → `{ updated: 0 }` (CLI maps to a refusal message).
  - `listFederationDirectoryInvites(filter)` — `filter = { issuerOwnerId?, status? }`. Returns rows with `link_ref, peer_domain, status, expires_at` only — no `code_hash`.
- Consumed by: `acceptDirectoryRedemption` (Task 8), the `sigil federation invite` CLI (Task 13).

- [ ] **Step 1: Write the failing test (Postgres)**

Add to `sigil/relay/v1/postgres-repository.directory-federation.test.mjs`:

```js
test('invite create -> getByRef -> lazy expire -> revoke', { skip: !connectionString }, async (t) => {
  const pool = new pg.Pool({ connectionString });
  t.after(() => pool.end());
  await applyMigrations(connectionString);
  const repo = new PostgresRepository({ pool });
  const linkRef = crypto.randomUUID();

  await repo.withTransaction((c) => repo.createFederationDirectoryInvite({
    linkRef, issuerEndpointId: 'ep_codex@a.example', issuerOwnerId: 'usr_chris@a.example',
    peerDomain: 'b.example', codeHash: 'HASH', expiresAt: new Date(Date.now() + 3600_000), now: new Date(),
  }, c));

  const row = await repo.getFederationDirectoryInviteByRef(linkRef, pool, {});
  assert.equal(row.status, 'pending');
  assert.equal(row.peer_domain, 'b.example');

  // force expiry, then getByRef must lazily transition
  await pool.query(`UPDATE federation_directory_invites SET expires_at = now() - interval '1 hour' WHERE link_ref = $1`, [linkRef]);
  const expired = await repo.getFederationDirectoryInviteByRef(linkRef, pool, {});
  assert.equal(expired.status, 'expired');

  const revoke = await repo.revokeFederationDirectoryInvite(linkRef, new Date(), pool);
  assert.equal(revoke.updated, 0); // already terminal (expired)
  await pool.query(`DELETE FROM federation_directory_invites WHERE link_ref = $1`, [linkRef]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SIGIL_TEST_DATABASE_URL=<dsn> node --test sigil/relay/v1/postgres-repository.directory-federation.test.mjs` → FAIL (methods undefined). Defer to Task 17 without a local DB.

- [ ] **Step 3: Implement the Postgres methods**

Add near the other federation methods in `sigil/relay/v1/postgres-repository.mjs`. Key detail — the lazy expiry in `getFederationDirectoryInviteByRef`:

```js
  async getFederationDirectoryInviteByRef(linkRef, client = this.pool, { forUpdate = false } = {}) {
    const lock = forUpdate ? ' FOR UPDATE' : '';
    const r = await client.query(`SELECT * FROM federation_directory_invites WHERE link_ref = $1${lock}`, [linkRef]);
    if (!r.rows[0]) return null;
    let row = r.rows[0];
    if (row.status === 'pending' && new Date(row.expires_at).getTime() <= Date.now()) {
      const upd = await client.query(
        `UPDATE federation_directory_invites SET status = 'expired' WHERE link_ref = $1 AND status = 'pending' RETURNING *`,
        [linkRef],
      );
      if (upd.rows[0]) row = upd.rows[0];
    }
    return rowToFederationDirectoryInvite(row);
  }
```

Add a `rowToFederationDirectoryInvite` mapper (snake_case passthrough is fine — the handlers read `row.code_hash`, `row.status`, `row.peer_domain`, `row.issuer_owner_id`, `row.issuer_endpoint_id`, `row.redeemed_by_owner_id`, `row.redeemed_by_endpoint_id`, `row.invite_id`, `row.link_ref`). `createFederationDirectoryInvite` is a plain `INSERT ... RETURNING invite_id, link_ref`. `markFederationDirectoryInviteRedeemed` is `UPDATE ... SET status='redeemed', redeemed_by_owner_id=$, redeemed_by_endpoint_id=$, redeemed_at=$ WHERE invite_id=$`. `revokeFederationDirectoryInvite` is `UPDATE ... SET status='revoked' WHERE link_ref=$ AND status='pending'` returning `{ updated: rowCount }`. `listFederationDirectoryInvites` selects only the four non-secret columns.

- [ ] **Step 4: Implement the memory-repo parity methods**

In `sigil/cli/memory-repository.mjs`, add a `federationDirectoryInvites` Map keyed by `link_ref` and the same method names. `withTransaction` is already a no-op (`fn(null)`), so `client` is ignored. Lazy expiry: in `getFederationDirectoryInviteByRef`, if `row.status === 'pending' && Date.parse(row.expires_at) <= Date.now()`, flip to `'expired'` before returning (no `await` between read and flip — single-writer, mirrors the file's existing `claimDirectoryMatch` comment).

- [ ] **Step 5: Run**

Run: `node --test sigil/cli/memory-repository.test.mjs` (add a small direct memory-repo test here mirroring Step 1, minus the DB skip). Postgres case → Task 17.
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add sigil/relay/v1/postgres-repository.mjs sigil/cli/memory-repository.mjs sigil/relay/v1/postgres-repository.directory-federation.test.mjs sigil/cli/memory-repository.test.mjs
git commit -m "feat(relay): federation_directory_invites repository methods with lazy expiry"
```

---

## Task 7: Repository — `federation_directory_links` methods (both repos)

**Files:**
- Modify: `sigil/relay/v1/postgres-repository.mjs`
- Modify: `sigil/cli/memory-repository.mjs`
- Test: `sigil/relay/v1/postgres-repository.directory-federation.test.mjs`, `sigil/cli/memory-repository.test.mjs`

**Interfaces:**
- Produces (both repos, identical signatures):
  - `createFederationDirectoryLink(row, client)` — `row = { linkRef, localOwnerId, localEndpointId, remoteOwnerId, remoteEndpointId, remoteDomain, role, status, localConfirmedAt, remoteConfirmedAt, sourceInviteId, peerDomain }`. On a partial-unique violation (`federation_directory_links_live_pair_uidx`), throw a typed error: `Object.assign(new Error('...'), { code: 'FEDERATION_LINK_EXISTS', existingLinkRef })`. On the Postgres side, catch driver error `23505` on that index name and `SELECT link_ref FROM federation_directory_links WHERE local_owner_id=$ AND remote_owner_id=$ AND remote_domain=$ AND status IN ('pending','active')` to populate `existingLinkRef`.
  - `getFederationDirectoryLinkByRef(linkRef, client, { forUpdate = false })` — returns the full row (snake_case) or `null`. Fields the handlers read: `link_ref, local_owner_id, local_endpoint_id, remote_owner_id, remote_endpoint_id, remote_domain, role, status, local_confirmed_at, remote_confirmed_at, peer_domain, revoked_at, revoked_by`.
  - `setFederationDirectoryLinkConfirmation(linkRef, side, now, client)` — `side ∈ ('local','remote')`. Compare-and-set: `UPDATE federation_directory_links SET <side>_confirmed_at = $now, status = CASE WHEN <other-side>_confirmed_at IS NOT NULL THEN 'active' ELSE 'pending' END, updated_at = $now WHERE link_ref = $ref AND status = 'pending' AND <side>_confirmed_at IS NULL`. Returns `{ updated: 0|1, activated: boolean }` (`activated` true iff the updated row's new status is `active`). **A `revoked` / `expired` / `active` row is never moved back to `pending`/`active` by this method** (the `WHERE status = 'pending'` guard).
  - `revokeFederationDirectoryLink(linkRef, by, now, client)` — `by ∈ ('local','remote')`. `UPDATE ... SET status='revoked', revoked_at=$now, revoked_by=$by, updated_at=$now WHERE link_ref=$ref AND status IN ('pending','active')`. Returns `{ updated: 0|1 }`.
  - `markFederationDirectoryLinkExpired(linkRef, reasonCode, now, client)` — `UPDATE ... SET status='expired', last_reason_code=$reason, updated_at=$now WHERE link_ref=$ref AND status='pending'`. Returns `{ updated: 0|1 }`. Called by the reaper on the redeemer relay when the redemption outbox row goes terminal-non-`forwarded`.
  - `listFederationDirectoryLinks(filter)` — `filter = { status?, role?, ownerId? }`. Returns `link_ref, role, local_owner_id, remote_owner_id, remote_domain, status, local_confirmed_at, remote_confirmed_at`.
  - `getActiveFederationDirectoryLink(localOwnerId, remoteOwnerId, remoteDomain, client)` — **the step-8 authority.** `SELECT * FROM federation_directory_links WHERE status='active' AND local_owner_id=$1 AND remote_owner_id=$2 AND remote_domain=$3 LIMIT 1`. Returns the row or `null`.
- Consumed by: `accept-federation-directory.mjs` (Tasks 8–9), `acceptFederatedEnvelope` step 8 (Task 12), the reaper (Task 11), the `sigil federation link` CLI (Task 14).

- [ ] **Step 1: Write the failing test (Postgres)**

Add to `sigil/relay/v1/postgres-repository.directory-federation.test.mjs`:

```js
test('link create -> confirm CAS -> revoke-wins race -> getActive', { skip: !connectionString }, async (t) => {
  const pool = new pg.Pool({ connectionString });
  t.after(() => pool.end());
  await applyMigrations(connectionString);
  const repo = new PostgresRepository({ pool });
  const linkRef = crypto.randomUUID();
  await repo.withTransaction((c) => repo.createFederationDirectoryLink({
    linkRef, localOwnerId: 'usr_chris@a.example', localEndpointId: 'ep_codex@a.example',
    remoteOwnerId: 'usr_bob@b.example', remoteEndpointId: 'ep_c@b.example', remoteDomain: 'b.example',
    role: 'issuer', status: 'pending', localConfirmedAt: null, remoteConfirmedAt: new Date(),
    sourceInviteId: null, peerDomain: 'b.example',
  }, c));

  // second live link for the same pair -> typed FEDERATION_LINK_EXISTS
  await assert.rejects(
    repo.withTransaction((c) => repo.createFederationDirectoryLink({
      linkRef: crypto.randomUUID(), localOwnerId: 'usr_chris@a.example', localEndpointId: 'ep_x@a.example',
      remoteOwnerId: 'usr_bob@b.example', remoteEndpointId: 'ep_y@b.example', remoteDomain: 'b.example',
      role: 'issuer', status: 'pending', localConfirmedAt: null, remoteConfirmedAt: new Date(),
      sourceInviteId: null, peerDomain: 'b.example',
    }, c)),
    (e) => e.code === 'FEDERATION_LINK_EXISTS' && e.existingLinkRef === linkRef,
  );

  const set = await repo.setFederationDirectoryLinkConfirmation(linkRef, 'local', new Date(), pool);
  assert.deepEqual(set, { updated: 1, activated: true });

  const active = await repo.getActiveFederationDirectoryLink('usr_chris@a.example', 'usr_bob@b.example', 'b.example', pool);
  assert.equal(active?.link_ref, linkRef);

  // revoke wins: after revoke, a late confirmation CAS updates nothing
  await repo.revokeFederationDirectoryLink(linkRef, 'local', new Date(), pool);
  const late = await repo.setFederationDirectoryLinkConfirmation(linkRef, 'remote', new Date(), pool);
  assert.equal(late.updated, 0);
  const afterRevoke = await repo.getActiveFederationDirectoryLink('usr_chris@a.example', 'usr_bob@b.example', 'b.example', pool);
  assert.equal(afterRevoke, null);

  await pool.query(`DELETE FROM federation_directory_links WHERE link_ref = $1`, [linkRef]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SIGIL_TEST_DATABASE_URL=<dsn> node --test sigil/relay/v1/postgres-repository.directory-federation.test.mjs` → FAIL (methods undefined). Defer to Task 17 without a local DB.

- [ ] **Step 3: Implement the Postgres methods**

Add to `sigil/relay/v1/postgres-repository.mjs`. The `createFederationDirectoryLink` typed-error path:

```js
  async createFederationDirectoryLink(row, client = this.pool) {
    try {
      const r = await client.query(
        `INSERT INTO federation_directory_links
           (link_ref, local_owner_id, local_endpoint_id, remote_owner_id, remote_endpoint_id,
            remote_domain, role, status, local_confirmed_at, remote_confirmed_at, source_invite_id,
            peer_domain, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), now())
         RETURNING *`,
        [row.linkRef, row.localOwnerId, row.localEndpointId, row.remoteOwnerId, row.remoteEndpointId,
         row.remoteDomain, row.role, row.status, row.localConfirmedAt, row.remoteConfirmedAt,
         row.sourceInviteId, row.peerDomain],
      );
      return rowToFederationDirectoryLink(r.rows[0]);
    } catch (error) {
      if (error?.code === '23505') {
        const existing = await client.query(
          `SELECT link_ref FROM federation_directory_links
            WHERE local_owner_id = $1 AND remote_owner_id = $2 AND remote_domain = $3
              AND status IN ('pending','active') LIMIT 1`,
          [row.localOwnerId, row.remoteOwnerId, row.remoteDomain],
        );
        throw Object.assign(new Error('A pending or active federation directory link already exists for this owner pair'), {
          code: 'FEDERATION_LINK_EXISTS',
          existingLinkRef: existing.rows[0]?.link_ref ?? null,
        });
      }
      throw error;
    }
  }
```

`setFederationDirectoryLinkConfirmation` — CAS with a `RETURNING status`:

```js
  async setFederationDirectoryLinkConfirmation(linkRef, side, now, client = this.pool) {
    const other = side === 'local' ? 'remote' : 'local';
    const r = await client.query(
      `UPDATE federation_directory_links
          SET ${side}_confirmed_at = $2,
              status = CASE WHEN ${other}_confirmed_at IS NOT NULL THEN 'active' ELSE 'pending' END,
              updated_at = $2
        WHERE link_ref = $1 AND status = 'pending' AND ${side}_confirmed_at IS NULL
        RETURNING status`,
      [linkRef, (now instanceof Date ? now : new Date(now)).toISOString()],
    );
    return { updated: r.rowCount, activated: r.rows[0]?.status === 'active' };
  }
```

`revokeFederationDirectoryLink`, `markFederationDirectoryLinkExpired`, `getActiveFederationDirectoryLink`, `getFederationDirectoryLinkByRef`, `listFederationDirectoryLinks` are straightforward parameterized statements matching the interface above. Add `rowToFederationDirectoryLink` (snake_case passthrough).

- [ ] **Step 4: Implement the memory-repo parity methods**

In `sigil/cli/memory-repository.mjs`: a `federationDirectoryLinks` Map keyed by `link_ref`. The live-pair uniqueness check is a synchronous `find` over the Map for a row with the same `(local_owner_id, remote_owner_id, remote_domain)` and `status ∈ ('pending','active')`, before insert — throw `FEDERATION_LINK_EXISTS` with `existingLinkRef`. The confirmation CAS: replicate the `WHERE status='pending' AND <side>_confirmed_at IS NULL` guard as an `if`; compute `activated` from whether the other side's timestamp is set. `getActiveFederationDirectoryLink` is a `find` on `status === 'active'` and the exact triple.

- [ ] **Step 5: Run**

Run: `node --test sigil/cli/memory-repository.test.mjs` (add a memory-repo mirror of Step 1 minus the DB skip).
Expected: PASS. Postgres → Task 17.

- [ ] **Step 6: Commit**

```
git add sigil/relay/v1/postgres-repository.mjs sigil/cli/memory-repository.mjs sigil/relay/v1/postgres-repository.directory-federation.test.mjs sigil/cli/memory-repository.test.mjs
git commit -m "feat(relay): federation_directory_links repository methods (CAS confirm, revoke-wins, step-8 lookup)"
```

---

## Task 8: `accept-federation-directory.mjs` — `acceptDirectoryRedemption`

**Files:**
- Create: `sigil/relay/v1/accept-federation-directory.mjs` (redemption handler + shared `respond` helper)
- Create: `sigil/relay/v1/accept-federation-directory.test.mjs`

**Interfaces:**
- Consumes: `parseDomain`, `parseFederatedId` from `./federated-id.mjs`; `node:crypto` (`crypto.timingSafeEqual`, `crypto.createHash`); Task 6 + Task 7 repo methods; the three new rate scopes (Task 16 wires the reservation — in this task, call `repository.reserveRateLimit('federation_directory_redemption_inbound', originDomain, windowStart, limit, client)` and reject `RATE_LIMITED` on a disallowed reservation, guarding it with `typeof repository.reserveRateLimit === 'function'`).
- Produces: `acceptDirectoryRedemption(parsedBody, ctx)` where `ctx = { repository, client, originDomain, now, request_id, relayDomain, rateLimits? }`. Returns `{ status, body: { request_id, code, message, details } }` on failure, `{ status: 202, body: { link_ref, issuer: { owner_id, endpoint_id } } }` on success.
- Consumed by: the `/v1/federation/directory/redemptions` route (Task 10).

- [ ] **Step 1: Write the failing test**

Create `sigil/relay/v1/accept-federation-directory.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createMemoryRepository } from '../../cli/memory-repository.mjs';
import { acceptDirectoryRedemption } from './accept-federation-directory.mjs';

const RELAY_DOMAIN = 'a.example';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function seedInvite(repo, { linkRef, segment, peerDomain = 'b.example', expiresAt }) {
  await repo.createFederationDirectoryInvite({
    linkRef, issuerEndpointId: 'ep_codex@a.example', issuerOwnerId: 'usr_chris@a.example',
    peerDomain, codeHash: sha256(segment), expiresAt: expiresAt ?? new Date(Date.now() + 3600_000), now: new Date(),
  }, null);
}
function redemptionBody({ linkRef, segment, issuerDomain = 'a.example', redeemerDomain = 'b.example' }) {
  return {
    link_ref: linkRef,
    code: `sigil-fed-invite:${issuerDomain}:${linkRef}:${segment}`,
    redeemer: { owner_id: 'usr_bob@b.example', endpoint_id: 'ep_c@b.example' },
    redeemer_domain: redeemerDomain,
    requested_at: '2026-09-02T12:00:00.000Z',
  };
}
const ctx = (repo, over = {}) => ({ repository: repo, client: null, originDomain: 'b.example', now: new Date(), request_id: 'req_1', relayDomain: RELAY_DOMAIN, ...over });

test('good code: writes a pending issuer-side link with remote_confirmed_at set, marks invite redeemed', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedInvite(repo, { linkRef, segment: 'SEG' });
  const res = await acceptDirectoryRedemption(redemptionBody({ linkRef, segment: 'SEG' }), ctx(repo));
  assert.equal(res.status, 202);
  assert.equal(res.body.link_ref, linkRef);
  assert.deepEqual(res.body.issuer, { owner_id: 'usr_chris@a.example', endpoint_id: 'ep_codex@a.example' });
  const invite = await repo.getFederationDirectoryInviteByRef(linkRef, null, {});
  assert.equal(invite.status, 'redeemed');
  const link = await repo.getFederationDirectoryLinkByRef(linkRef, null, {});
  assert.equal(link.status, 'pending');
  assert.equal(link.role, 'issuer');
  assert.ok(link.remote_confirmed_at);
  assert.equal(link.local_confirmed_at, null);
});

test('unknown / expired / revoked / redeemed-by-another all collapse to one INVALID_FEDERATION_INVITE', async () => {
  const repo = createMemoryRepository();
  // unknown
  let res = await acceptDirectoryRedemption(redemptionBody({ linkRef: crypto.randomUUID(), segment: 'SEG' }), ctx(repo));
  assert.equal(res.body.code, 'INVALID_FEDERATION_INVITE');
  assert.equal(res.status, 403);
  // expired
  const l2 = crypto.randomUUID();
  await seedInvite(repo, { linkRef: l2, segment: 'SEG', expiresAt: new Date(Date.now() - 1000) });
  res = await acceptDirectoryRedemption(redemptionBody({ linkRef: l2, segment: 'SEG' }), ctx(repo));
  assert.equal(res.body.code, 'INVALID_FEDERATION_INVITE');
  const expired = await repo.getFederationDirectoryInviteByRef(l2, null, {});
  assert.equal(expired.status, 'expired'); // transitioned in the same call
});

test('embedded issuer domain that is not this relay -> 400 INVALID_FEDERATION_REQUEST', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedInvite(repo, { linkRef, segment: 'SEG' });
  const res = await acceptDirectoryRedemption(redemptionBody({ linkRef, segment: 'SEG', issuerDomain: 'evil.example' }), ctx(repo));
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_FEDERATION_REQUEST');
});

test('redeemer_domain != verified originDomain -> 400', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedInvite(repo, { linkRef, segment: 'SEG' });
  const res = await acceptDirectoryRedemption(redemptionBody({ linkRef, segment: 'SEG', redeemerDomain: 'c.example' }), ctx(repo));
  assert.equal(res.status, 400);
});

test('same redeemer re-post on an already-redeemed invite -> 202, same link_ref, no second row', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedInvite(repo, { linkRef, segment: 'SEG' });
  await acceptDirectoryRedemption(redemptionBody({ linkRef, segment: 'SEG' }), ctx(repo));
  const res = await acceptDirectoryRedemption(redemptionBody({ linkRef, segment: 'SEG' }), ctx(repo));
  assert.equal(res.status, 202);
  assert.equal(res.body.link_ref, linkRef);
});

test('owner-pair collision under a different link_ref -> 409 FEDERATION_LINK_EXISTS, invite left pending', async () => {
  const repo = createMemoryRepository();
  const first = crypto.randomUUID(); const second = crypto.randomUUID();
  await seedInvite(repo, { linkRef: first, segment: 'S1' });
  await acceptDirectoryRedemption(redemptionBody({ linkRef: first, segment: 'S1' }), ctx(repo));
  await seedInvite(repo, { linkRef: second, segment: 'S2' });
  const res = await acceptDirectoryRedemption(redemptionBody({ linkRef: second, segment: 'S2' }), ctx(repo));
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'FEDERATION_LINK_EXISTS');
  assert.equal(res.body.details.existing_link_ref, first);
  const invite = await repo.getFederationDirectoryInviteByRef(second, null, {});
  assert.equal(invite.status, 'pending');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/relay/v1/accept-federation-directory.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the handler**

Create `sigil/relay/v1/accept-federation-directory.mjs`:

```js
import crypto from 'node:crypto';
import { parseDomain, parseFederatedId } from './federated-id.mjs';

export function respond(status, code, message, ctx, details = {}) {
  return { status, body: { request_id: ctx.request_id ?? null, code, message, details } };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
function constantTimeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8'); const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function acceptDirectoryRedemption(parsedBody, ctx) {
  const { repository, client, originDomain, now, relayDomain } = ctx;
  const audit = (eventType, reason, extra = {}) => repository.recordAuditEvent?.({
    eventType, outcome: reason ? 'rejected' : 'accepted', reason: reason ?? null,
    payload: { peer_domain: originDomain, link_ref: parsedBody?.link_ref ?? null, ...extra }, now,
  }).catch(() => {});

  // 1. Structural.
  const code = parsedBody?.code;
  if (typeof code !== 'string') return respond(400, 'INVALID_FEDERATION_REQUEST', 'code is required', ctx);
  const parts = code.split(':');
  if (parts.length !== 4 || parts[0] !== 'sigil-fed-invite') return respond(400, 'INVALID_FEDERATION_REQUEST', 'code is not a sigil-fed-invite:<domain>:<link-ref>:<segment>', ctx);
  const [, issuerDomain, embeddedRef, segment] = parts;
  try { parseDomain(issuerDomain); } catch { return respond(400, 'INVALID_FEDERATION_REQUEST', 'issuer domain in code is malformed', ctx); }
  if (!relayDomain || issuerDomain.toLowerCase() !== String(relayDomain).toLowerCase()) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'code issuer domain does not name this relay', ctx);
  }
  if (!UUID_RE.test(embeddedRef) || embeddedRef !== parsedBody.link_ref) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'link_ref mismatch between code and body', ctx);
  }
  const redeemer = parsedBody.redeemer;
  try {
    parseFederatedId(redeemer.owner_id);
    if (parseFederatedId(redeemer.endpoint_id).domain.toLowerCase() !== originDomain.toLowerCase()) throw new Error('endpoint domain');
  } catch { return respond(400, 'INVALID_FEDERATION_REQUEST', 'redeemer ids are malformed or not on the posting domain', ctx); }
  try { parseDomain(parsedBody.redeemer_domain); } catch { return respond(400, 'INVALID_FEDERATION_REQUEST', 'redeemer_domain is malformed', ctx); }
  if (parsedBody.redeemer_domain.toLowerCase() !== originDomain.toLowerCase()) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'redeemer_domain does not equal the verified posting relay', ctx);
  }

  // (rate) — load-bearing anti-guessing scope, keyed per posting peer domain.
  if (typeof repository.reserveRateLimit === 'function') {
    const windowStart = new Date(Math.floor((now instanceof Date ? now.getTime() : Date.parse(now)) / 60_000) * 60_000).toISOString();
    const limit = ctx.rateLimits?.federation_directory_redemption_inbound ?? 60;
    const r = await repository.reserveRateLimit('federation_directory_redemption_inbound', originDomain, windowStart, limit, client);
    if (r && r.allowed === false) return respond(429, 'RATE_LIMITED', 'redemption rate limit for this peer domain exceeded', ctx, { scope_kind: 'federation_directory_redemption_inbound' });
  }

  // 2. Invite lookup + secret hash compare (constant-time). Lazy expiry happens inside getByRef.
  const invite = await repository.getFederationDirectoryInviteByRef(parsedBody.link_ref, client, { forUpdate: true });
  const genericInvalid = () => { audit('federation_directory.redemption_rejected', 'INVALID_FEDERATION_INVITE'); return respond(403, 'INVALID_FEDERATION_INVITE', 'Redemption code is not valid', ctx); };
  if (!invite) return genericInvalid();
  if (!constantTimeEqualHex(sha256Hex(segment), invite.code_hash)) return genericInvalid();

  // 3. Peer-domain match.
  if (invite.peer_domain.toLowerCase() !== originDomain.toLowerCase()) return genericInvalid();

  // 4. Idempotent replay for a 'redeemed' invite.
  if (invite.status === 'redeemed') {
    if (invite.redeemed_by_owner_id === redeemer.owner_id && invite.redeemed_by_endpoint_id === redeemer.endpoint_id) {
      return respond(202, 'ACCEPTED', 'already redeemed by this redeemer', ctx, {}); // shape adjusted below
    }
    return genericInvalid();
  }
  if (invite.status !== 'pending') return genericInvalid(); // expired / revoked

  // 5. Owner-pair collision under a different link_ref.
  // 6. Write: mark invite redeemed + create the issuer-side link, one transaction.
  await repository.markFederationDirectoryInviteRedeemed(invite.invite_id, redeemer, now, client);
  let link;
  try {
    link = await repository.createFederationDirectoryLink({
      linkRef: parsedBody.link_ref,
      localOwnerId: invite.issuer_owner_id, localEndpointId: invite.issuer_endpoint_id,
      remoteOwnerId: redeemer.owner_id, remoteEndpointId: redeemer.endpoint_id,
      remoteDomain: originDomain, role: 'issuer', status: 'pending',
      localConfirmedAt: null, remoteConfirmedAt: now, sourceInviteId: invite.invite_id, peerDomain: originDomain,
    }, client);
  } catch (error) {
    if (error.code === 'FEDERATION_LINK_EXISTS') {
      // per spec step 5: invite stays pending in this branch. On a no-op-capable
      // store this means NOT persisting the markRedeemed above -- run this check
      // BEFORE step 6's markRedeemed instead (reorder in implementation): do a
      // getActive/live-pair probe first, and only markRedeemed + create once it
      // is clear no different-link_ref live row exists.
      audit('federation_directory.redemption_rejected', 'FEDERATION_LINK_EXISTS');
      return respond(409, 'FEDERATION_LINK_EXISTS', 'A federation directory link already exists for this owner pair', ctx, { existing_link_ref: error.existingLinkRef });
    }
    throw error;
  }

  audit('federation_directory.redemption_accepted', null);
  audit('federation_directory.link_created', null, { role: 'issuer' });
  return respond(202, 'ACCEPTED', 'redemption accepted', ctx, {
    link_ref: parsedBody.link_ref,
    issuer: { owner_id: invite.issuer_owner_id, endpoint_id: invite.issuer_endpoint_id },
  });
}
```

**Implementation note — step ordering for the 409 branch:** the spec (step 5) says the invite must stay `pending` on a collision. Restructure so the live-pair collision is detected *before* `markFederationDirectoryInviteRedeemed`: query the live pair first (`getActiveFederationDirectoryLink` plus a pending-status probe, or a dedicated `findLiveFederationDirectoryLinkForPair` helper), return `409` if found under a different `link_ref`, and only then `markRedeemed` + `createFederationDirectoryLink` inside the transaction. The `catch` on `FEDERATION_LINK_EXISTS` stays as defence-in-depth for a concurrent insert.

Fix the success/idempotent `respond` shape: success returns `{ status: 202, body: { request_id, link_ref, issuer } }` — not the `code/message/details` envelope. Have `respond` accept a raw-body override, or write those two returns as explicit object literals.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sigil/relay/v1/accept-federation-directory.test.mjs`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```
git add sigil/relay/v1/accept-federation-directory.mjs sigil/relay/v1/accept-federation-directory.test.mjs
git commit -m "feat(relay): acceptDirectoryRedemption handler"
```

---

## Task 9: `accept-federation-directory.mjs` — confirmation + revocation handlers

**Files:**
- Modify: `sigil/relay/v1/accept-federation-directory.mjs` (add `acceptDirectoryConfirmation`, `acceptDirectoryRevocation`)
- Modify: `sigil/relay/v1/accept-federation-directory.test.mjs`

**Interfaces:**
- Consumes: Task 7 repo methods (`getFederationDirectoryLinkByRef` with `forUpdate`, `setFederationDirectoryLinkConfirmation`, `revokeFederationDirectoryLink`).
- Produces:
  - `acceptDirectoryConfirmation(parsedBody, ctx)` — `parsedBody = { link_ref, confirmed_at }`. Returns `{ status: 202, body: {...} }` on success/no-op; `404 FEDERATION_LINK_NOT_FOUND` for an unknown ref; `403 PEER_NOT_TRUSTED` when the stored row's `peer_domain !== originDomain`; `400 INVALID_FEDERATION_REQUEST` for a malformed body.
  - `acceptDirectoryRevocation(parsedBody, ctx)` — `parsedBody = { link_ref, revoked_at }`. `202` no-op for an unknown ref (**no existence leak**); `403 PEER_NOT_TRUSTED` on a `peer_domain` mismatch; `202` on a repeat.
- Consumed by: the `/confirmations` and `/revocations` routes (Task 10).

- [ ] **Step 1: Write the failing tests**

Add to `sigil/relay/v1/accept-federation-directory.test.mjs`:

```js
import { acceptDirectoryConfirmation, acceptDirectoryRevocation } from './accept-federation-directory.mjs';

async function seedLink(repo, { linkRef, role = 'issuer', status = 'pending', localConfirmedAt = null, remoteConfirmedAt = null, peerDomain = 'b.example' }) {
  await repo.createFederationDirectoryLink({
    linkRef, localOwnerId: 'usr_chris@a.example', localEndpointId: 'ep_codex@a.example',
    remoteOwnerId: 'usr_bob@b.example', remoteEndpointId: 'ep_c@b.example', remoteDomain: 'b.example',
    role, status, localConfirmedAt, remoteConfirmedAt, sourceInviteId: null, peerDomain,
  }, null);
}

test('confirmation: sets remote_confirmed_at; flips to active only when local is also set', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedLink(repo, { linkRef, localConfirmedAt: new Date() });   // local already set on the issuer relay
  const res = await acceptDirectoryConfirmation({ link_ref: linkRef, confirmed_at: '2026-09-02T12:05:00Z' }, ctx(repo));
  assert.equal(res.status, 202);
  const link = await repo.getFederationDirectoryLinkByRef(linkRef, null, {});
  assert.equal(link.status, 'active');
  assert.ok(link.remote_confirmed_at);
});

test('confirmation: unknown link_ref -> 404 FEDERATION_LINK_NOT_FOUND', async () => {
  const repo = createMemoryRepository();
  const res = await acceptDirectoryConfirmation({ link_ref: crypto.randomUUID(), confirmed_at: '2026-09-02T12:05:00Z' }, ctx(repo));
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'FEDERATION_LINK_NOT_FOUND');
});

test('confirmation: posting relay != row peer_domain -> 403 PEER_NOT_TRUSTED', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedLink(repo, { linkRef, peerDomain: 'other.example' });
  const res = await acceptDirectoryConfirmation({ link_ref: linkRef, confirmed_at: '2026-09-02T12:05:00Z' }, ctx(repo));
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'PEER_NOT_TRUSTED');
});

test('confirmation after revocation never reactivates (revocation wins)', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedLink(repo, { linkRef, status: 'revoked' });
  const res = await acceptDirectoryConfirmation({ link_ref: linkRef, confirmed_at: '2026-09-02T12:05:00Z' }, ctx(repo));
  assert.equal(res.status, 202);
  const link = await repo.getFederationDirectoryLinkByRef(linkRef, null, {});
  assert.equal(link.status, 'revoked');
});

test('duplicate confirmation on an already-active row -> 202 no-op', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedLink(repo, { linkRef, status: 'active', localConfirmedAt: new Date(), remoteConfirmedAt: new Date() });
  const res = await acceptDirectoryConfirmation({ link_ref: linkRef, confirmed_at: '2026-09-02T12:05:00Z' }, ctx(repo));
  assert.equal(res.status, 202);
});

test('revocation: sets revoked/remote; repeat -> 202; unknown ref -> 202 no-op (no leak); wrong relay -> 403', async () => {
  const repo = createMemoryRepository();
  const linkRef = crypto.randomUUID();
  await seedLink(repo, { linkRef, status: 'active', localConfirmedAt: new Date(), remoteConfirmedAt: new Date() });
  let res = await acceptDirectoryRevocation({ link_ref: linkRef, revoked_at: '2026-09-02T13:00:00Z' }, ctx(repo));
  assert.equal(res.status, 202);
  let link = await repo.getFederationDirectoryLinkByRef(linkRef, null, {});
  assert.equal(link.status, 'revoked');
  assert.equal(link.revoked_by, 'remote');
  res = await acceptDirectoryRevocation({ link_ref: linkRef, revoked_at: '2026-09-02T13:00:00Z' }, ctx(repo));
  assert.equal(res.status, 202); // idempotent
  res = await acceptDirectoryRevocation({ link_ref: crypto.randomUUID(), revoked_at: '2026-09-02T13:00:00Z' }, ctx(repo));
  assert.equal(res.status, 202); // unknown -> no-op, no existence leak

  const other = crypto.randomUUID();
  await seedLink(repo, { linkRef: other, peerDomain: 'other.example' });
  res = await acceptDirectoryRevocation({ link_ref: other, revoked_at: '2026-09-02T13:00:00Z' }, ctx(repo));
  assert.equal(res.status, 403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/relay/v1/accept-federation-directory.test.mjs`
Expected: FAIL — `acceptDirectoryConfirmation` / `acceptDirectoryRevocation` not exported.

- [ ] **Step 3: Write the handlers**

Add to `sigil/relay/v1/accept-federation-directory.mjs`:

```js
function isoString(v) { return typeof v === 'string' && !Number.isNaN(Date.parse(v)); }

export async function acceptDirectoryConfirmation(parsedBody, ctx) {
  const { repository, client, originDomain, now } = ctx;
  const audit = (eventType, extra = {}) => repository.recordAuditEvent?.({
    eventType, outcome: 'accepted', reason: null,
    payload: { peer_domain: originDomain, link_ref: parsedBody?.link_ref ?? null, ...extra }, now,
  }).catch(() => {});

  // 1. Structural.
  if (!UUID_RE.test(parsedBody?.link_ref ?? '') || !isoString(parsedBody?.confirmed_at)) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'link_ref must be a uuid and confirmed_at an ISO timestamp', ctx);
  }
  // 2. Link lookup (FOR UPDATE) + peer_domain pin.
  const link = await repository.getFederationDirectoryLinkByRef(parsedBody.link_ref, client, { forUpdate: true });
  if (!link) return respond(404, 'FEDERATION_LINK_NOT_FOUND', 'No local link row for this link_ref', ctx);
  if (link.peer_domain.toLowerCase() !== originDomain.toLowerCase()) {
    return respond(403, 'PEER_NOT_TRUSTED', 'Posting relay is not the peer named by this link', ctx);
  }
  // 3. Terminal / idempotent (revocation wins).
  if (link.status === 'revoked' || link.status === 'expired') return respond(202, 'ACCEPTED', 'no-op (terminal)', ctx);
  if (link.remote_confirmed_at && (link.status === 'pending' || link.status === 'active')) {
    return respond(202, 'ACCEPTED', 'no-op (already confirmed)', ctx);
  }
  // 4. Write (compare-and-set).
  const { updated, activated } = await repository.setFederationDirectoryLinkConfirmation(parsedBody.link_ref, 'remote', now, client);
  if (updated) {
    audit('federation_directory.confirmation_accepted', { side: 'remote' });
    if (activated) audit('federation_directory.link_activated');
  }
  // zero update = a concurrent revocation flipped status; treat as step-3 no-op.
  return respond(202, 'ACCEPTED', 'confirmation processed', ctx);
}

export async function acceptDirectoryRevocation(parsedBody, ctx) {
  const { repository, client, originDomain, now } = ctx;
  if (!UUID_RE.test(parsedBody?.link_ref ?? '') || !isoString(parsedBody?.revoked_at)) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'link_ref must be a uuid and revoked_at an ISO timestamp', ctx);
  }
  const link = await repository.getFederationDirectoryLinkByRef(parsedBody.link_ref, client, { forUpdate: true });
  if (!link) return respond(202, 'ACCEPTED', 'no-op', ctx); // no existence leak
  if (link.peer_domain.toLowerCase() !== originDomain.toLowerCase()) {
    return respond(403, 'PEER_NOT_TRUSTED', 'Posting relay is not the peer named by this link', ctx);
  }
  if (link.status === 'revoked') return respond(202, 'ACCEPTED', 'no-op (already revoked)', ctx);
  const { updated } = await repository.revokeFederationDirectoryLink(parsedBody.link_ref, 'remote', now, client);
  if (updated) {
    repository.recordAuditEvent?.({
      eventType: 'federation_directory.revocation_accepted', outcome: 'accepted', reason: null,
      payload: { peer_domain: originDomain, link_ref: parsedBody.link_ref, revoked_by: 'remote' }, now,
    }).catch(() => {});
  }
  return respond(202, 'ACCEPTED', 'revocation processed', ctx);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sigil/relay/v1/accept-federation-directory.test.mjs`
Expected: PASS (redemption cases from Task 8 stay green; the 7 new confirmation/revocation cases pass).

- [ ] **Step 5: Commit**

```
git add sigil/relay/v1/accept-federation-directory.mjs sigil/relay/v1/accept-federation-directory.test.mjs
git commit -m "feat(relay): acceptDirectoryConfirmation and acceptDirectoryRevocation handlers"
```

---

## Task 10: HTTP routes — `/v1/federation/directory/{redemptions,confirmations,revocations}`

**Files:**
- Modify: `sigil/relay/v1/http-server.mjs` (three routes beside `/v1/federation/envelopes`, before the `authenticateRequest` gate — around line 158–176)
- Test: `sigil/relay/v1/http-server.federation-inbound.test.mjs` (add directory-route cases) or a new `sigil/relay/v1/http-server.federation-directory.test.mjs`

**Interfaces:**
- Consumes: `verifyInboundRelayRequest` (Task 3), `acceptDirectory*` (Tasks 8–9), `repository`, `relayDomain` (already `createRelayServer` params). The Postgres-only gate uses a feature probe: `typeof repository?.enqueueFederationForward === 'function'` — that method is Postgres-only (the memory repo never gets it), and it is exactly "has a durable outbox", which is the spec's Postgres requirement.
- Produces: three `POST` routes. Each: **first** — if `!federationMode || typeof repository?.enqueueFederationForward !== 'function'` → `501 FEDERATION_DIRECTORY_UNAVAILABLE` immediately (before body read / signature). Otherwise: read raw body, `verifyInboundRelayRequest(raw, headers, { getPeerByKid })`, open `repository.withTransaction`, dispatch to the matching `acceptDirectory*` with `ctx = { repository, client, originDomain, now, request_id: requestId, relayDomain }`, write `result.status` + `result.body`.

- [ ] **Step 1: Write the failing test**

Create `sigil/relay/v1/http-server.federation-directory.test.mjs` modeled on `http-server.federation-inbound.test.mjs`:

```js
// - a directory route on a memory-repo relay (no enqueueFederationForward) -> 501 FEDERATION_DIRECTORY_UNAVAILABLE
// - a directory route with no federationMode -> 501 (or 404 if the route is only registered under federationMode; assert whichever the impl chooses, spec says 501)
// - a well-formed signed redemption against a Postgres relay -> 202 and a pending link row (skip: !SIGIL_TEST_DATABASE_URL)
// - a redemption whose kid is unpinned -> 403 PEER_NOT_TRUSTED
// - a confirmation with a bad signature -> 401 RELAY_SIGNATURE_INVALID
```

Write the 501 cases first (they need no DB): stand up `createRelayServer({ repository: createMemoryRepository(), federationMode: 'queue', relayDomain: 'a.example', ... })`, `POST /v1/federation/directory/redemptions`, assert `res.statusCode === 501` and body `code === 'FEDERATION_DIRECTORY_UNAVAILABLE'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/relay/v1/http-server.federation-directory.test.mjs`
Expected: FAIL — the route is unhandled, falls through to 404.

- [ ] **Step 3: Add the routes**

In `sigil/relay/v1/http-server.mjs`, immediately after the `/v1/federation/envelopes` block (line ~176), add:

```js
    // Cross-federation directory routes (#4). Postgres-only: the 501 pre-gate is
    // the cheapest possible reject -- before any body read or signature work.
    const DIRECTORY_ROUTES = {
      '/v1/federation/directory/redemptions': 'redemption',
      '/v1/federation/directory/confirmations': 'confirmation',
      '/v1/federation/directory/revocations': 'revocation',
    };
    if (request.method === 'POST' && DIRECTORY_ROUTES[parsedUrl.pathname]) {
      if (!federationMode || typeof repository?.enqueueFederationForward !== 'function') {
        response.writeHead(501, { 'content-type': 'application/json', 'x-sigil-request-id': requestId });
        return response.end(JSON.stringify({ request_id: requestId, code: 'FEDERATION_DIRECTORY_UNAVAILABLE', message: 'This relay is not Postgres-backed; cross-federation directory is unavailable', details: {} }));
      }
      let raw;
      try { raw = await readBody(request); }
      catch (error) { response.writeHead(413, { 'content-type': 'application/json', 'x-sigil-request-id': requestId }); return response.end(JSON.stringify({ request_id: requestId, code: error.code, message: error.message, details: {} })); }
      const headers = {};
      for (const [k, v] of Object.entries(request.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;

      const { verifyInboundRelayRequest } = await import('./federation-relay-auth.mjs');
      let verified;
      try {
        verified = await verifyInboundRelayRequest(Buffer.from(raw), headers, { getPeerByKid: (kid) => repository.getPeerByKid(kid) });
      } catch (error) {
        response.writeHead(error.httpStatus ?? 400, { 'content-type': 'application/json', 'x-sigil-request-id': requestId });
        return response.end(JSON.stringify({ request_id: requestId, code: error.code ?? 'INVALID_FEDERATION_REQUEST', message: error.message, details: {} }));
      }

      const { acceptDirectoryRedemption, acceptDirectoryConfirmation, acceptDirectoryRevocation } = await import('./accept-federation-directory.mjs');
      const handler = { redemption: acceptDirectoryRedemption, confirmation: acceptDirectoryConfirmation, revocation: acceptDirectoryRevocation }[DIRECTORY_ROUTES[parsedUrl.pathname]];
      const nowValue = now();
      const result = await repository.withTransaction((client) => handler(verified.parsedBody, {
        repository, client, originDomain: verified.originDomain, now: nowValue, request_id: requestId, relayDomain,
      }));
      response.writeHead(result.status, { 'content-type': 'application/json', 'x-sigil-request-id': requestId });
      return response.end(result.body ? JSON.stringify(result.body) : '');
    }
```

(Match the local `now` accessor the file uses — `configuredNow` is `now: configuredNow = () => new Date()`; the envelopes route uses `now`. Use the same.) Prefer top-of-file static imports over dynamic `import()` if the surrounding code does — check how `acceptFederatedEnvelope` is imported (line 4, static) and match that.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sigil/relay/v1/http-server.federation-directory.test.mjs sigil/relay/v1/http-server.test.mjs sigil/relay/v1/http-server.federation-inbound.test.mjs`
Expected: 501 cases PASS; existing http-server suites stay green. Postgres 202 case → Task 17.

- [ ] **Step 5: Commit**

```
git add sigil/relay/v1/http-server.mjs sigil/relay/v1/http-server.federation-directory.test.mjs
git commit -m "feat(relay): three cross-federation directory HTTP routes with a Postgres-only 501 pre-gate"
```

---

## Task 11: Outbox `kind` dispatch — enqueue + reaper

**Files:**
- Modify: `sigil/relay/v1/postgres-repository.mjs` (`enqueueFederationForward` accepts `kind` / `directoryPayload`; row mapper surfaces them; `claimDueFederationForwards` select includes the new columns)
- Modify: `sigil/relay/v1/federation-reaper.mjs` (dispatch on `row.kind`; expire the redeemer link row on a terminal `directory_redemption`)
- Test: `sigil/relay/v1/federation-reaper.test.mjs`

**Interfaces:**
- Consumes: `buildRedemptionRequest` / `buildConfirmationRequest` / `buildRevocationRequest` / `signRelayRequest` / `postDirectory` (Task 5); `markFederationDirectoryLinkExpired` (Task 7).
- Produces:
  - `enqueueFederationForward(row, client)` — `row` now optionally carries `{ kind, directoryPayload, messageId, idempotencyKey, recipientDomain, originDomain }` with `envelope`/`senderKey`/`senderOwnerId` omitted for `kind !== 'envelope'`. `INSERT` includes `kind` and `directory_payload`; the existing `ON CONFLICT (message_id, idempotency_key) DO NOTHING` is unchanged.
  - Reaper: `runFederationReaperPass` dispatches per row — `kind === 'envelope'` → existing `buildForwardRequest`/`postForward` path (unchanged); `kind` starting `directory_` → build the signed request from `row.directoryPayload` via the matching `build*Request` + `signRelayRequest`, `postDirectory(peer, PATH_BY_KIND[kind], canonicalBytes, signed, { fetchImpl })`. `PATH_BY_KIND = { directory_redemption: '/v1/federation/directory/redemptions', directory_confirmation: '/v1/federation/directory/confirmations', directory_revocation: '/v1/federation/directory/revocations' }`.
  - On a **terminal non-`forwarded`** state (`forward_rejected` or `dead_letter`) for a `directory_redemption` row, after `finalize`, call `repository.markFederationDirectoryLinkExpired(row.directoryPayload.link_ref, row.lastReasonCode ?? peerCode ?? state, now, client)` inside a short transaction. `directory_confirmation` / `directory_revocation` terminal states do not expire anything.
- Note: `originDomain` passed to `runFederationReaperPass` is the reaper's own relay domain — used as the redeemer domain in `buildRedemptionRequest` is **wrong**; the redemption body's `redeemer_domain` was already fixed at enqueue time and travels in `directory_payload`. The reaper must send `directory_payload` **verbatim** as the body (it is already the exact JCS wire body) and only sign it — do **not** re-run `build*Request` for directory kinds. Re-canonicalize `directory_payload` with `canonicalJsonBytes` for the signing input, send that same byte buffer as the HTTP body.

- [ ] **Step 1: Write the failing test**

Add to `sigil/relay/v1/federation-reaper.test.mjs`:

```js
test('a directory_redemption row posts via postDirectory to /redemptions with directory_payload as the body', async () => {
  const posts = [];
  const postDirectoryImpl = async (peer, path, bytes) => { posts.push({ path, body: JSON.parse(Buffer.from(bytes).toString()) }); return { ok: true, status: 202 }; };
  const row = {
    id: 'r1', kind: 'directory_redemption', claimToken: 'ct1', attemptCount: 0,
    recipientDomain: 'b.example',
    directoryPayload: { link_ref: 'L1', code: 'sigil-fed-invite:a.example:L1:SEG', redeemer: { owner_id: 'usr_bob@b.example', endpoint_id: 'ep_c@b.example' }, redeemer_domain: 'b.example', requested_at: '2026-09-02T12:00:00.000Z' },
  };
  const repository = makeFakeRepo({ claimRows: [row] });   // reuse the file's existing fake-repo helper, extended to return `kind`/`directoryPayload`
  const counts = await runFederationReaperPass({ repository, identity: TEST_IDENTITY, originDomain: 'a.example', now: new Date(), postDirectoryImpl });
  assert.equal(counts.forwarded, 1);
  assert.equal(posts[0].path, '/v1/federation/directory/redemptions');
  assert.equal(posts[0].body.link_ref, 'L1');
});

test('a directory_redemption that the peer 4xx-rejects -> forward_rejected AND the redeemer link row is expired', async () => {
  const expired = [];
  const repository = makeFakeRepo({
    claimRows: [{ id: 'r2', kind: 'directory_redemption', claimToken: 'ct2', attemptCount: 0, recipientDomain: 'b.example',
      directoryPayload: { link_ref: 'L2', code: 'sigil-fed-invite:a.example:L2:SEG', redeemer: { owner_id: 'usr_bob@b.example', endpoint_id: 'ep_c@b.example' }, redeemer_domain: 'b.example', requested_at: '2026-09-02T12:00:00.000Z' } }],
    markFederationDirectoryLinkExpired: async (linkRef, reason) => { expired.push({ linkRef, reason }); return { updated: 1 }; },
  });
  const postDirectoryImpl = async () => ({ ok: false, status: 403, peerCode: 'INVALID_FEDERATION_INVITE' });
  const counts = await runFederationReaperPass({ repository, identity: TEST_IDENTITY, originDomain: 'a.example', now: new Date(), postDirectoryImpl });
  assert.equal(counts.rejected, 1);
  assert.deepEqual(expired, [{ linkRef: 'L2', reason: 'INVALID_FEDERATION_INVITE' }]);
});

test('kind = envelope rows are unaffected and still carry a non-null envelope', async () => {
  // existing envelope test still green; add an assertion that the dispatch
  // branch for 'envelope' calls buildForwardRequest, not postDirectory.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/relay/v1/federation-reaper.test.mjs`
Expected: the two new cases FAIL (`row.kind` is ignored; every row goes through `buildForwardRequest`, which throws on a row with no `envelope`). Existing envelope cases stay green.

- [ ] **Step 3: Implement the enqueue change**

In `sigil/relay/v1/postgres-repository.mjs`, `enqueueFederationForward`:

```js
  async enqueueFederationForward(row, client = this.pool) {
    const ts = row.now == null ? new Date().toISOString()
      : (row.now instanceof Date ? row.now.toISOString() : new Date(row.now).toISOString());
    const kind = row.kind ?? 'envelope';
    const inserted = await client.query(
      `INSERT INTO federation_outbox
         (message_id, idempotency_key, recipient_domain, origin_domain, kind,
          envelope, sender_key, sender_owner_id, directory_payload, next_attempt_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$10)
       ON CONFLICT (message_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [row.messageId, row.idempotencyKey, row.recipientDomain, row.originDomain, kind,
       row.envelope == null ? null : JSON.stringify(row.envelope),
       row.senderKey == null ? null : JSON.stringify(row.senderKey),
       row.senderOwnerId ?? null,
       row.directoryPayload == null ? null : JSON.stringify(row.directoryPayload),
       ts],
    );
    if (inserted.rows[0]) return { row: rowToFederationOutboxRecord(inserted.rows[0]), inserted: true };
    const existing = await client.query('SELECT * FROM federation_outbox WHERE message_id = $1 AND idempotency_key = $2', [row.messageId, row.idempotencyKey]);
    return { row: rowToFederationOutboxRecord(existing.rows[0]), inserted: false };
  }
```

Update `rowToFederationOutboxRecord` to map `kind` and parse `directory_payload` → `directoryPayload`. Update `claimDueFederationForwards` and `listFederationOutbox` selects to include `kind` (they use `SELECT *` for claim, so only the mapper needs the field; `listFederationOutbox`'s explicit column list should add `kind`).

- [ ] **Step 4: Implement the reaper dispatch**

In `sigil/relay/v1/federation-reaper.mjs`:
1. `import { canonicalJsonBytes } from './jcs.mjs';` and `import { signRelayRequest } from './federation-directory-client.mjs';` and `import { postDirectory } from './federation-directory-client.mjs';`
2. Inside the `for (const row of rows)` loop, branch at the top:

```js
    if (row.kind && row.kind !== 'envelope') {
      const PATH_BY_KIND = {
        directory_redemption: '/v1/federation/directory/redemptions',
        directory_confirmation: '/v1/federation/directory/confirmations',
        directory_revocation: '/v1/federation/directory/revocations',
      };
      const path = PATH_BY_KIND[row.kind];
      let signed, canonicalBytes;
      try {
        canonicalBytes = canonicalJsonBytes(row.directoryPayload);
        signed = signRelayRequest(canonicalBytes, identity);
      } catch {
        await finalize(repository, row, 'dead_letter', { attemptCount: row.attemptCount, reasonCode: 'FORWARD_BUILD_FAILED' });
        counts.deadLettered += 1;
        continue;
      }
      let outcome, transportFailed = false;
      try {
        const peer = await repository.getPeerByDomain(row.recipientDomain);
        if (!peer) { transportFailed = true; }
        else outcome = await (postDirectoryImpl ?? postDirectory)({ relayUrl: peer.relayUrl }, path, canonicalBytes, signed, { fetchImpl });
      } catch (error) {
        if (error?.code === 'FORWARD_TRANSPORT_FAILED') transportFailed = true; else throw error;
      }
      // transport failure: same 1m/5m/30m backoff + MAX_ATTEMPTS dead-letter path as envelope rows
      // 2xx: finalize 'forwarded'
      // 4xx: finalize 'forward_rejected' (terminal)
      // On 'forward_rejected' OR 'dead_letter' AND row.kind === 'directory_redemption':
      //   await repository.withTransaction((client) =>
      //     repository.markFederationDirectoryLinkExpired(row.directoryPayload.link_ref, reasonCode, now, client));
      // audit through federation.forward_unavailable / federation.dead_letter / federation.forwarded / federation.forward_rejected with row.kind added to the payload.
      continue;
    }
```

Factor the transport-failure / 2xx / 4xx finalize+audit sequence into a small local helper so the `envelope` and `directory_*` branches share it — the only directory-specific addition is the `markFederationDirectoryLinkExpired` call on a terminal `directory_redemption`.
3. Add `postDirectoryImpl` to the `runFederationReaperPass` destructured params (test seam, mirrors `postForwardImpl`).

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test sigil/relay/v1/federation-reaper.test.mjs`
Expected: PASS — the two new directory cases pass; every existing envelope case stays green.

- [ ] **Step 6: Commit**

```
git add sigil/relay/v1/postgres-repository.mjs sigil/relay/v1/federation-reaper.mjs sigil/relay/v1/federation-reaper.test.mjs
git commit -m "feat(relay): reaper dispatches federation_outbox rows by kind; directory posts + link-expire on terminal redemption"
```

---

## Task 12: `acceptFederatedEnvelope` step 8 — the active-link second pass

**Files:**
- Modify: `sigil/relay/v1/accept-federated-envelope.mjs:127-130` (step 8)
- Test: `sigil/relay/v1/accept-federated-envelope.test.mjs`

**Interfaces:**
- Consumes: `repository.getActiveFederationDirectoryLink(localOwnerId, remoteOwnerId, remoteDomain, client)` (Task 7). Guard with `typeof repository.getActiveFederationDirectoryLink === 'function'` so a memory-repo relay (which has the method after Task 7) and any older repo both behave — a missing method means "no link", i.e. the existing `DIRECTORY_LINK_REQUIRED`.
- Produces: step 8 becomes: same-owner exemption first (unchanged); else look up an active link for `(recipient.owner_id, senderOwnerId, originDomain)`; if found → deliver; else → `reject('DIRECTORY_LINK_REQUIRED', ..., { reason: 'no_active_federation_directory_link' })`. Same error **code** as today; the only addition is `details.reason` distinguishing the same-owner path from the link path. Runs in the same transaction / `client` as steps 6–10. `envelope.sender.owner_id` (the sender's own claim) is still never used — only the relay-attested `senderOwnerId`.

- [ ] **Step 1: Write the failing tests**

Add to `sigil/relay/v1/accept-federated-envelope.test.mjs`:

```js
test('step 8: cross-owner + an active federation directory link -> delivered and inbox-visible', async () => {
  const { repository, deliverForwardBody } = await seedFederatedInboundFixture({
    recipient: { endpoint_id: 'ep_claude@a.example', owner_id: 'usr_chris@a.example' },
  });
  await repository.createFederationDirectoryLink({
    linkRef: crypto.randomUUID(),
    localOwnerId: 'usr_chris@a.example', localEndpointId: 'ep_claude@a.example',
    remoteOwnerId: 'usr_bob@b.example', remoteEndpointId: 'ep_codex@b.example', remoteDomain: 'b.example',
    role: 'redeemer', status: 'active', localConfirmedAt: new Date(), remoteConfirmedAt: new Date(),
    sourceInviteId: null, peerDomain: 'b.example',
  }, null);
  const res = await deliverForwardBody({ senderOwnerId: 'usr_bob@b.example', senderEndpoint: 'ep_codex@b.example' });
  assert.equal(res.status, 202);
  assert.equal(res.body.code, 'ACCEPTED');
});

test('step 8: cross-owner + a pending / revoked / expired link, or no row -> 403 DIRECTORY_LINK_REQUIRED with reason', async () => {
  for (const linkStatus of ['pending', 'revoked', 'expired', null]) {
    const { repository, deliverForwardBody } = await seedFederatedInboundFixture({
      recipient: { endpoint_id: 'ep_claude@a.example', owner_id: 'usr_chris@a.example' },
    });
    if (linkStatus) {
      await repository.createFederationDirectoryLink({
        linkRef: crypto.randomUUID(), localOwnerId: 'usr_chris@a.example', localEndpointId: 'ep_claude@a.example',
        remoteOwnerId: 'usr_bob@b.example', remoteEndpointId: 'ep_codex@b.example', remoteDomain: 'b.example',
        role: 'redeemer', status: linkStatus, localConfirmedAt: null, remoteConfirmedAt: null,
        sourceInviteId: null, peerDomain: 'b.example',
      }, null);
    }
    const res = await deliverForwardBody({ senderOwnerId: 'usr_bob@b.example', senderEndpoint: 'ep_codex@b.example' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'DIRECTORY_LINK_REQUIRED');
    assert.equal(res.body.details.reason, 'no_active_federation_directory_link');
  }
});

test('step 8: an active link for one remote owner does not authorise a different remote owner on the same domain', async () => {
  const { repository, deliverForwardBody } = await seedFederatedInboundFixture({
    recipient: { endpoint_id: 'ep_claude@a.example', owner_id: 'usr_chris@a.example' },
  });
  await repository.createFederationDirectoryLink({
    linkRef: crypto.randomUUID(), localOwnerId: 'usr_chris@a.example', localEndpointId: 'ep_claude@a.example',
    remoteOwnerId: 'usr_bob@b.example', remoteEndpointId: 'ep_codex@b.example', remoteDomain: 'b.example',
    role: 'redeemer', status: 'active', localConfirmedAt: new Date(), remoteConfirmedAt: new Date(),
    sourceInviteId: null, peerDomain: 'b.example',
  }, null);
  const res = await deliverForwardBody({ senderOwnerId: 'usr_dave@b.example', senderEndpoint: 'ep_dave@b.example' });
  assert.equal(res.status, 403);
});

test('step 8: same-owner still delivers with no link row (unchanged)', async () => {
  const { deliverForwardBody } = await seedFederatedInboundFixture({
    recipient: { endpoint_id: 'ep_claude@a.example', owner_id: 'usr_shared@a.example' },
  });
  const res = await deliverForwardBody({ senderOwnerId: 'usr_shared@a.example', senderEndpoint: 'ep_codex@b.example' });
  assert.equal(res.status, 202);
});
```

Use the file's existing fixture builder for a signed inbound forward; add a thin `seedFederatedInboundFixture` / `deliverForwardBody` wrapper if the current tests inline that setup.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs`
Expected: the "active link → delivered" case FAILS (`DIRECTORY_LINK_REQUIRED` fires unconditionally for cross-owner); same-owner case still PASSES.

- [ ] **Step 3: Rewrite step 8**

Replace lines ~127–130 of `sigil/relay/v1/accept-federated-envelope.mjs`:

```js
    // 8: directory gate.
    if (senderOwnerId === recipient.owner_id) {
      // same-owner exemption (design #3) — checked first, unchanged.
    } else {
      const link = typeof repository.getActiveFederationDirectoryLink === 'function'
        ? await repository.getActiveFederationDirectoryLink(recipient.owner_id, senderOwnerId, originDomain, client)
        : null;
      if (!link) {
        throw reject('DIRECTORY_LINK_REQUIRED', 'No active cross-federation directory link authorises this cross-owner delivery', {
          sender_owner_id: senderOwnerId,
          recipient_endpoint_id: recipientId,
          reason: 'no_active_federation_directory_link',
        });
      }
      // link.status === 'active' — deliver.
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs sigil/relay/v1/accept-federated-envelope.pg.test.mjs sigil/relay/v1/federation-regression.test.mjs`
Expected: PASS — all new step-8 cases pass; #3's same-owner and rejection cases stay green.

- [ ] **Step 5: Commit**

```
git add sigil/relay/v1/accept-federated-envelope.mjs sigil/relay/v1/accept-federated-envelope.test.mjs
git commit -m "feat(relay): acceptFederatedEnvelope step 8 accepts an active federation directory link"
```

---

## Task 13: CLI — `sigil federation invite` subgroup

**Files:**
- Modify: `sigil/cli/sigil.mjs` (`cmdFederation` grows an `invite` group beside `outbox`; `usage()` text)
- Test: `sigil/cli/sigil-federation-directory.test.mjs` (live-DB, `skip: !connectionString`, modeled on `sigil-federation-outbox.test.mjs`)

**Interfaces:**
- Consumes: `withRepository(args, requireMsg, fn, { migrate: true })`; `parseDomain` / `parseFederatedId` from `../relay/v1/federated-id.mjs`; `loadIdentity(identityPath)` (returns `{ owner_id, ... }`) for actor binding; `crypto.randomUUID()` + `crypto.randomBytes(24).toString('base64url')` for the link ref + secret segment; `sha256` for the stored hash; Task 5 `buildRedemptionRequest`; Task 6/7 repo methods; `repository.enqueueFederationForward`.
- Actor binding: every mint/confirm/revoke that the spec says needs "an authenticated human session whose owner equals X" is enforced in the CLI as `--identity <path>` whose loaded `owner_id` equals X. (If a local directory-trust CLI precedent exists in this repo with a different human-session mechanism, match it; otherwise `--identity` is the operator-side equivalent, consistent with `sigil route test`.)
- Produces subcommands:
  - `sigil federation invite create --peer <domain> --endpoint <federated-id> --identity <path> [--ttl <duration>] [--database-url url]` — assert `parseDomain(--peer)`, `parseFederatedId(--endpoint).domain === relay --domain` (read the relay domain from the identity/registry or require a `--domain` flag matching the endpoint), `loadIdentity(--identity).owner_id === parseFederatedId(--endpoint).owner_id`. Mint `linkRef = randomUUID()`, `segment = randomBytes(24).base64url`, `codeHash = sha256(segment)`. `createFederationDirectoryInvite({ linkRef, issuerEndpointId, issuerOwnerId, peerDomain, codeHash, expiresAt: now + ttl (default 24h, clamp [1h,7d]), now })`. Print `sigil-fed-invite:<relay-domain>:<linkRef>:<segment>` **once**, then a line with the bare `linkRef`. Persist only the hash. Audit `federation_directory.invite_created`.
  - `sigil federation invite list [--database-url url]` — `listFederationDirectoryInvites({})` → tab rows `link_ref  peer_domain  status  expires_at`. No hashes, no segments.
  - `sigil federation invite revoke <link_ref> [--database-url url]` — `revokeFederationDirectoryInvite(linkRef, now)`. `{ updated: 1 }` → "Revoked invite <link_ref>." `{ updated: 0 }` → look up the invite; if `redeemed` print "already redeemed — use `sigil federation link revoke <link_ref>`" and `process.exitCode = 1`; if terminal print "already <status>" and exit 1. Audit `federation_directory.invite_revoked`.
  - `sigil federation invite redeem <code> --identity <path> [--database-url url]` — parse the code into `[_, issuerDomain, linkRef, segment]`; `parseDomain(issuerDomain)`; `repository.getPeerByDomain(issuerDomain)` — absent → print "pin the peer relay first: sigil peer resolve --domain <issuerDomain>" and exit 1. `loadIdentity(--identity)` gives the redeemer `{ owner_id, endpoint_id }` (or take `--endpoint` explicitly and assert its owner matches the identity).
    **Synchronous redemption (locked design — decision (b)):** the `redeem` command builds and signs the redemption request (`buildRedemptionRequest` + `signRelayRequest` with this relay's `--federation-identity` key), then **`postDirectory(peerA, '/v1/federation/directory/redemptions', canonicalBytes, signed)` synchronously** and waits for the response.
      - On `202` — the body carries `{ link_ref, issuer: { owner_id, endpoint_id } }`. Now the redeemer relay knows the issuer identity, so it writes its local `federation_directory_links` row **fully populated**: `role = 'redeemer'`, `status = 'pending'`, `local_confirmed_at = now` (redeeming is B's consent, per local §3.1.3), `remote_confirmed_at = null`, `local_owner_id/local_endpoint_id` = the redeemer, `remote_owner_id/remote_endpoint_id` = the issuer from the `202` body, `remote_domain = peer_domain = issuerDomain`, `initiated_via = 'invite'`, `source_invite_id = null` (issuer-relay-only column). Schema `NOT NULL` + `CHECK (local_owner_id <> remote_owner_id)` are satisfied on the first write — no sentinel, no backfill. Print the `link_ref` and "waiting for issuer confirmation." Audit `federation_directory.invite_redeemed`.
      - On a `4xx` (`INVALID_FEDERATION_INVITE`, `409 FEDERATION_LINK_EXISTS`) — print the mapped error, write **no** link row, exit 1. Terminal; the code will not become good.
      - On a transport failure / `5xx` / timeout — write no link row and instead `enqueueFederationForward({ kind: 'directory_redemption', messageId: linkRef, idempotencyKey: linkRef, recipientDomain: issuerDomain, originDomain: <redeemer relay domain>, directoryPayload: buildRedemptionRequest(...).body })` as the **retry fallback**, print "issuer relay unreachable; redemption queued for retry — run `sigil federation link show <link_ref>` after it drains", exit 0. When the reaper later drains this row and gets its `202`, it writes the redeemer link row from the `202` body (the reaper's `directory_redemption` success branch gains this write — note it in Task 11). This keeps the common path synchronous while preserving durability when the peer is down.
- Every subcommand aborts with the documented limitation when `--database-url` / `SIGIL_DATABASE_URL` is absent (`withRepository`'s `requireMsg`).

> **Cross-task note for Task 11:** the reaper's `directory_redemption` **`202` success branch** must also write the redeemer relay's `federation_directory_links` row from the response body (`{ link_ref, issuer }`) when it does not already exist — this is the fallback path for a `redeem` whose synchronous POST failed and fell through to the outbox. Idempotent: if the row already exists (sync POST succeeded, or a prior reaper pass wrote it), skip. The terminal-non-`forwarded` → `markFederationDirectoryLinkExpired` path in Task 11 still applies for the case where the row does exist.

- [ ] **Step 1: Write the failing test**

Create `sigil/cli/sigil-federation-directory.test.mjs` (mirror `sigil-federation-outbox.test.mjs`'s harness: `run(argv)` helper, `connectionString = process.env.SIGIL_TEST_DATABASE_URL`, `skip: !connectionString`). Cases:

```
- `invite create` prints exactly one parseable `sigil-fed-invite:<domain>:<uuid>:<segment>` line and one bare link_ref line; a SELECT shows only sha256(segment) stored, never the segment.
- `invite create` with an --identity whose owner_id != the --endpoint owner -> non-zero exit, "must own the endpoint".
- `invite list` shows the row with status=pending and no hash/segment substring in stdout.
- `invite revoke <link_ref>` on a pending invite -> "Revoked", status=revoked in DB; a second `invite revoke` -> exit 1 "already revoked".
- `invite redeem <code>` for an unpinned issuer domain -> exit 1 "pin the peer relay first".
- every subcommand without --database-url -> throws the documented limitation.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/cli/sigil-federation-directory.test.mjs`
Expected: FAIL — `usage: sigil federation outbox ...` (the `group !== 'outbox'` guard rejects `invite`). The no-DB limitation case may already pass.

- [ ] **Step 3: Extend `cmdFederation`**

In `sigil/cli/sigil.mjs`, restructure `cmdFederation` (line 768) to dispatch on `group`:

```js
async function cmdFederation(argv) {
  const [group, action, ...rest] = argv;
  if (group === 'outbox') return cmdFederationOutbox(action, rest);   // existing body, extracted verbatim
  if (group === 'invite') return cmdFederationInvite(action, rest);
  if (group === 'link') return cmdFederationLink(action, rest);       // Task 14
  throw new Error('usage: sigil federation <outbox|invite|link> ...');
}
```

Extract the current `outbox` body into `cmdFederationOutbox(action, rest)` unchanged. Write `cmdFederationInvite(action, rest)` per the interface above. Reuse `withRepository(args, requireMsg, fn, { migrate: true })`. For `create`, the `sha256` helper: `crypto.createHash('sha256').update(segment).digest('hex')`.

- [ ] **Step 4: Update `usage()`**

Add to the `usage()` help block (near line 62–64):

```
  federation invite create --peer <domain> --endpoint <fid> --identity <path> [--ttl 24h] [--database-url url]
  federation invite list [--database-url url]
  federation invite revoke <link_ref> [--database-url url]
  federation invite redeem <code> --identity <path> [--database-url url]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test sigil/cli/sigil-federation-directory.test.mjs`
Expected: PASS (or the DB-backed cases defer to Task 17; the no-DB limitation + usage cases pass now).

- [ ] **Step 6: Commit**

```
git add sigil/cli/sigil.mjs sigil/cli/sigil-federation-directory.test.mjs
git commit -m "feat(cli): sigil federation invite create/list/revoke/redeem"
```

---

## Task 14: CLI — `sigil federation link` subgroup

**Files:**
- Modify: `sigil/cli/sigil.mjs` (`cmdFederationLink`; `usage()`)
- Test: `sigil/cli/sigil-federation-directory.test.mjs`

**Interfaces:**
- Consumes: `withRepository`; Task 7 repo methods; Task 5 `buildConfirmationRequest` / `buildRevocationRequest`; `repository.enqueueFederationForward`; `loadIdentity` for actor binding; the audit-event reconstruction for `link show`.
- Produces:
  - `sigil federation link list [--status <s>] [--database-url url]` — `listFederationDirectoryLinks({ status })` → tab rows `link_ref  role  local_owner_id  remote_owner_id@remote_domain  status  local_confirmed_at  remote_confirmed_at`.
  - `sigil federation link show <link_ref> [--database-url url]` — one row plus its transition history reconstructed from `federation_directory.*` audit events (query `GET /v1/audit`-style: `repository.listAuditEvents?.({ subjectId: link_ref })` or the repo's audit query method — check what `sigil` uses elsewhere; if none, print the row only and note history needs the audit query). No hashes.
  - `sigil federation link confirm <link_ref> --identity <path> [--database-url url]` — the issuer's explicit side confirmation. `getFederationDirectoryLinkByRef(linkRef)`; refuse if `role === 'redeemer'` ("that side auto-confirmed at redemption") or the row is terminal. Assert `loadIdentity(--identity).owner_id === row.local_owner_id`. `setFederationDirectoryLinkConfirmation(linkRef, 'local', now)`; on `{ updated: 1 }` → enqueue `{ kind: 'directory_confirmation', messageId: linkRef, idempotencyKey: linkRef + ':confirm', recipientDomain: row.peer_domain, originDomain: <relay domain>, directoryPayload: buildConfirmationRequest({ linkRef, now }).body }`, print "Confirmed; peer notification enqueued." On `{ updated: 0 }` → print "link is already revoked/terminal; nothing enqueued" and exit 1. Audit `federation_directory.link_confirmed` (+ `.link_activated` if `activated`).
  - `sigil federation link revoke <link_ref> --identity <path> [--database-url url]` — either role. Assert the identity owner equals `row.local_owner_id`. `revokeFederationDirectoryLink(linkRef, 'local', now)`; `{ updated: 1 }` → enqueue `{ kind: 'directory_revocation', messageId: linkRef, idempotencyKey: linkRef + ':revoke', recipientDomain: row.peer_domain, ..., directoryPayload: buildRevocationRequest({ linkRef, now }).body }`, print "Revoked; peer notification enqueued." Refused only if already `revoked` (`{ updated: 0 }` and status revoked) → exit 1. Audit `federation_directory.link_revoked` (`local`).
- Every subcommand aborts without `--database-url`.

**Interfaces produced for Task 13:** `messageId` / `idempotencyKey` conventions — redemption `(linkRef, linkRef)`; confirmation `(linkRef, linkRef + ':confirm')`; revocation `(linkRef, linkRef + ':revoke')`. Matches the spec's "synthesise `message_id` and `idempotency_key` from the parsed `link_ref`."

- [ ] **Step 1: Write the failing test**

Add to `sigil/cli/sigil-federation-directory.test.mjs`:

```
- `link confirm <ref>` by an --identity whose owner != local_owner_id -> exit 1 "not the link owner".
- `link confirm` on a role='redeemer' row -> exit 1 "redeemer side auto-confirmed".
- `link confirm` on a pending issuer row with remote already set -> status=active, a federation_outbox row with kind='directory_confirmation' and idempotency_key ending ':confirm'.
- `link revoke <ref>` from either role -> status=revoked, a federation_outbox row kind='directory_revocation'; a second `link revoke` -> exit 1 "already revoked".
- `link list` / `link show` print no hash or code-segment substrings.
- every subcommand without --database-url -> documented limitation.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/cli/sigil-federation-directory.test.mjs` → FAIL (`link` group unhandled).

- [ ] **Step 3: Implement `cmdFederationLink`**

Add to `sigil/cli/sigil.mjs` per the interface. Guard the enqueue behind `typeof repository.enqueueFederationForward === 'function'` (it always is on the Postgres path `withRepository` builds, but keep the guard for symmetry).

- [ ] **Step 4: Update `usage()`**

```
  federation link list [--status s] [--database-url url]
  federation link show <link_ref> [--database-url url]
  federation link confirm <link_ref> --identity <path> [--database-url url]
  federation link revoke <link_ref> --identity <path> [--database-url url]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test sigil/cli/sigil-federation-directory.test.mjs`
Expected: PASS (DB-backed cases defer to Task 17).

- [ ] **Step 6: Commit**

```
git add sigil/cli/sigil.mjs sigil/cli/sigil-federation-directory.test.mjs
git commit -m "feat(cli): sigil federation link list/show/confirm/revoke"
```

---

## Task 15: `sigil route test` — the advisory directory-link line

**Files:**
- Modify: `sigil/cli/sigil.mjs` `cmdRoute` (after the same-owner advisory block, ~line 878–892)
- Test: `sigil/cli/sigil-route-test.test.mjs`

**Interfaces:**
- Consumes: `repository.getActiveFederationDirectoryLink(localOwnerId, remoteOwnerId, remoteDomain, client)` — only reachable when `--database-url` is set (the peer lookup already gates on that). `localOwnerId` = the identity's `owner_id`; `remoteOwnerId` = the recipient endpoint's owner — but `route test` only has the recipient *endpoint id*, not its owner. So the advisory can only run when the recipient owner is derivable: parse it if the recipient federated id encodes it, else print "Directory link: not determinable locally (recipient owner unknown)". When the recipient is foreign, not same-owner, and `--database-url` is present, query by `(identity.owner_id, <recipient owner if known>, parsed.domain)`.
- Produces: one extra advisory line — `Directory link: active (link_ref <ref>)` or `Directory link: none — delivery would be DIRECTORY_LINK_REQUIRED` or `Directory link: not determinable locally`. Advisory only; sends no envelope; re-checked by the receiving relay.

- [ ] **Step 1: Write the failing test**

Add to `sigil/cli/sigil-route-test.test.mjs` (live-DB, `skip` without a connection string): seed a pinned peer + an active `federation_directory_links` row for the owner pair, run `sigil route test <recipient> --identity <path> --database-url <dsn>`, assert stdout contains `Directory link: active (link_ref `. Then revoke the link and assert `Directory link: none`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sigil/cli/sigil-route-test.test.mjs` → FAIL (no such line).

- [ ] **Step 3: Add the advisory line**

In `cmdRoute`, after the existing same-owner advisory (the block ending line ~892), when `peer` is set (foreign + pinned) and the same-owner exemption would NOT apply and `databaseUrl` is present:

```js
  if (peer && recipientEntry && recipientEntry.owner_id !== loadIdentity(identityPath).owner_id && databaseUrl) {
    await withRepository(args, '', async (repository) => {
      const link = await repository.getActiveFederationDirectoryLink(
        loadIdentity(identityPath).owner_id, recipientEntry.owner_id, parsed.domain, undefined,
      );
      if (link) console.log(`Directory link: active (link_ref ${link.link_ref})`);
      else console.log('Directory link: none — delivery would be DIRECTORY_LINK_REQUIRED');
    });
  } else if (peer) {
    console.log('Directory link: not determinable locally');
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sigil/cli/sigil-route-test.test.mjs`
Expected: PASS (or defer to Task 17).

- [ ] **Step 5: Commit**

```
git add sigil/cli/sigil.mjs sigil/cli/sigil-route-test.test.mjs
git commit -m "feat(cli): sigil route test prints an advisory federation directory-link line"
```

---

## Task 16: Rate scopes — invite-create, redeem, redemption-inbound

**Files:**
- Modify: `sigil/relay/v1/relay-config.mjs` (default limits for the three new scopes, if that file holds the `resolveRateLimits` defaults)
- Modify: `sigil/cli/sigil.mjs` (`invite create` reserves `federation_directory_invite_create`; `invite redeem` reserves `federation_directory_redeem`)
- Modify: `sigil/relay/v1/accept-federation-directory.mjs` (`acceptDirectoryRedemption` already reserves `federation_directory_redemption_inbound` from Task 8 — verify the guess-vs-infra accounting here)
- Test: `sigil/relay/v1/accept-federation-directory.test.mjs`, `sigil/cli/sigil-federation-directory.test.mjs`

**Interfaces:**
- Consumes: `repository.reserveRateLimit(scopeKind, scopeId, windowStart, limit, client)` → `{ allowed: boolean }` (existing #3 signature; `017` already widened `quota_usage_scope_kind_check`, and Task 1's `018` adds the three `federation_directory_*` values).
- Produces: three enforced scopes.
  - `federation_directory_invite_create` — keyed `issuerEndpointId + ':' + issuerOwnerId`. Reserved in the `invite create` CLI path before the insert. Over limit → abort "invite-create rate limit reached", exit 1.
  - `federation_directory_redeem` — keyed `redeemerEndpointId + ':' + redeemerOwnerId`. Reserved in `invite redeem` before the row write.
  - `federation_directory_redemption_inbound` — keyed per posting `originDomain`. Reserved in `acceptDirectoryRedemption` (Task 8). **Guess-driven rejections consume quota; infrastructure failures do not** — the reservation happens after the structural checks pass but before the invite lookup, so a malformed body is rejected without consuming quota, while a well-formed guess at a non-existent code does consume it. Confirmation/revocation posts are bounded by #3's existing `federation_origin` scope — no new counter.

- [ ] **Step 1: Write the failing test**

Add to `sigil/relay/v1/accept-federation-directory.test.mjs`:

```js
test('redemption: a well-formed guess at an unknown code consumes redemption-inbound quota; a malformed body does not', async () => {
  const reserved = [];
  const repo = createMemoryRepository();
  repo.reserveRateLimit = async (kind, id) => { reserved.push([kind, id]); return { allowed: true }; };
  // malformed: bad code shape
  await acceptDirectoryRedemption({ code: 'nope', link_ref: 'x', redeemer: { owner_id: 'a', endpoint_id: 'b' }, redeemer_domain: 'b.example' }, ctx(repo));
  assert.equal(reserved.length, 0);
  // well-formed guess at an unknown link_ref
  const linkRef = crypto.randomUUID();
  await acceptDirectoryRedemption(redemptionBody({ linkRef, segment: 'SEG' }), ctx(repo));
  assert.deepEqual(reserved, [['federation_directory_redemption_inbound', 'b.example']]);
});

test('redemption: reserveRateLimit allowed:false -> 429 RATE_LIMITED', async () => {
  const repo = createMemoryRepository();
  repo.reserveRateLimit = async () => ({ allowed: false });
  const linkRef = crypto.randomUUID();
  const res = await acceptDirectoryRedemption(redemptionBody({ linkRef, segment: 'SEG' }), ctx(repo));
  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'RATE_LIMITED');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test sigil/relay/v1/accept-federation-directory.test.mjs`
Expected: the ordering assertion FAILS if Task 8 placed the reservation before the structural checks — move it to just after structural validation, before the invite lookup.

- [ ] **Step 3: Fix reservation ordering in `acceptDirectoryRedemption`**

Ensure the `reserveRateLimit('federation_directory_redemption_inbound', originDomain, ...)` call sits **after** all `INVALID_FEDERATION_REQUEST` structural returns and **before** `getFederationDirectoryInviteByRef`. Add default limits (e.g. `federation_directory_redemption_inbound: 60` per minute per peer domain) wherever `resolveRateLimits` reads defaults.

- [ ] **Step 4: Wire the CLI-side scopes**

In `invite create` and `invite redeem` (Task 13), before the DB write, call `repository.reserveRateLimit(scope, key, windowStart, limit)` and abort on `allowed: false`. `windowStart` = the minute-floored ISO string, same formula as `acceptFederatedEnvelope:133`.

- [ ] **Step 5: Run**

Run: `node --test sigil/relay/v1/accept-federation-directory.test.mjs sigil/cli/sigil-federation-directory.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add sigil/relay/v1/accept-federation-directory.mjs sigil/relay/v1/relay-config.mjs sigil/cli/sigil.mjs sigil/relay/v1/accept-federation-directory.test.mjs
git commit -m "feat(relay): enforce the three cross-federation directory rate scopes"
```

---

## Task 17: Full-suite verification, live-DB matrix, and regression sweep

**Files:**
- Modify: `sigil/relay/v1/postgres-repository.directory-federation.test.mjs` (fill in the remaining live-DB matrix cases)
- Modify: `.github/workflows/*.yml` — the federation live-DB CI job (find the job that runs `postgres-repository.federation-outbox.test.mjs` and add the new test files to its `node --test` invocation)
- Test: all of the above plus the full repo suite

**Interfaces:**
- Consumes: everything from Tasks 1–16.
- Produces: green full suite; the live-DB matrix from the spec's Testing section.

- [ ] **Step 1: Fill in the live-DB matrix**

In `sigil/relay/v1/postgres-repository.directory-federation.test.mjs`, add the spec's Postgres-matrix cases not yet covered:

```
- 018 applies clean against a fresh DB (Task 1 — confirm it is here).
- the partial unique index blocks a second pending/active link for one owner pair and ALLOWS a new row once the prior one is 'revoked'.
- two concurrent redemption posts for one invite -> exactly one 'redeemed', the other idempotent 202, proven under FOR UPDATE row locking (spawn two `acceptDirectoryRedemption` calls on two clients against one seeded invite inside `Promise.all`; assert one 202+link, one 202-idempotent or INVALID_FEDERATION_INVITE, and exactly one link row).
- the federation_outbox `kind` column is back-compatible: existing 'envelope' rows read and drain unchanged (insert a legacy-shaped row with kind defaulted, run a reaper pass, assert it forwards).
- getActiveFederationDirectoryLink returns a row only in 'active' state (seed pending/revoked/expired, assert null; seed active, assert the row).
- a directory row with a null directory_payload is rejected by the 018 CHECK constraint at insert time.
```

- [ ] **Step 2: Run the full local suite**

Run: `npm test` (or the repo's canonical `node --test` glob). Do **one** run — do not stack background runs (a full `node --test` here is > 10 min and overlapping runs deadlock on the shared pg + ports; kill any zombie `node` first with `Stop-Process -Name node` if a prior run hung).
Expected: green except pre-existing skips. Compare the pass/skip/fail counts to the pre-Task-1 baseline — the only deltas should be the new test files' additions.

- [ ] **Step 3: Run the live-DB matrix**

Run: `SIGIL_TEST_DATABASE_URL=<dsn> node --test sigil/relay/v1/postgres-repository.directory-federation.test.mjs sigil/relay/v1/postgres-repository.peer.test.mjs sigil/cli/sigil-federation-directory.test.mjs sigil/cli/sigil-route-test.test.mjs sigil/relay/v1/http-server.federation-directory.test.mjs`
Expected: all green. Local pg for this repo is `localhost:55432` (`sigil:sigil_password` / `sigil_test`) per the session memory.

- [ ] **Step 4: Regression assertions**

Confirm by targeted runs:
- A relay with `--federation-mode sync` (no Postgres) rejects `sigil federation invite create` with the documented limitation and returns `501 FEDERATION_DIRECTORY_UNAVAILABLE` from the three routes.
- A `--domain` relay with no `--federation-mode` runs no directory logic: the three routes return `501 FEDERATION_DIRECTORY_UNAVAILABLE` (fail-closed, locked — see Self-review resolved decision 2).
- The local `directory-trust.mjs` path and `directory-trust.test.mjs`, `memory-repository.directory-trust.test.mjs`, `postgres-repository.directory-invites.test.mjs`, `postgres-repository.directory-links.test.mjs` are byte-unchanged and green.
- `#3`'s `federation-regression.test.mjs`, `accept-federated-envelope.test.mjs`, `federation-reaper.test.mjs`, `federation-router.test.mjs`, `http-server.federation-inbound.test.mjs` are all green.

- [ ] **Step 5: Wire the CI job**

Find the workflow job that runs the `federation_outbox` live-DB test (grep `.github/workflows` for `federation-outbox` or `SIGIL_TEST_DATABASE_URL`). Add the new test files to that job's test invocation so the matrix runs in CI.

- [ ] **Step 6: Update STATUS.md and commit**

Update `STATUS.md` (per the repo's shared session contract) with the shipped feature, the test counts, and any deferred item. Then:

```
git add sigil/relay/v1/postgres-repository.directory-federation.test.mjs .github/workflows/ STATUS.md
git commit -m "test(relay): cross-federation directory live-DB matrix + CI wiring"
```

- [ ] **Step 7: Push**

Only after the full suite is green and STATUS.md is current:

```
git push
```

The repo's `pre-push` hook runs the full `node --test` (> 10 min). Do not start a parallel `npm test` while it runs. If the hook is the guarded local variant (`sync-github-wiki.mjs` MODULE_NOT_FOUND workaround from a prior session), confirm it still passes the directory tests.

---

## Self-review

Checked the plan against the spec section by section:

**Spec coverage:**
- Problem / Decision (invite-code on-ramp, dual-half link, step-8 second pass) → Tasks 8, 10, 11, 12.
- `federation-relay-auth.mjs` / `verifyInboundRelayRequest` → Task 3; `acceptFederatedEnvelope` steps 1–3 refactor + the `origin_domain`-vs-`kid` mismatch case → Task 4.
- `federation-directory-client.mjs` builders + `postDirectory` + `postForward` refactor + `signForwardRequest`/`signRelayRequest` alias → Task 5.
- `accept-federation-directory.mjs` three handlers, every numbered sub-step (structural, invite lookup + constant-time hash, peer-domain match, idempotent replay, owner-pair collision 409, write, respond; confirmation CAS + revocation-wins; revocation no-leak) → Tasks 8, 9.
- New routes + 501 pre-gate + unauthenticated-beyond-relay-signature → Task 10.
- Wire formats (redemption / confirmation / revocation bodies; timestamp-policy) → Tasks 5, 8, 9 (timestamp policy asserted: no handler branches on `*_at`).
- State machine happy path (invite create → share → redeem → reaper drain → confirm → reaper drain → active both sides) → Tasks 11, 13, 14; the "terminal non-forwarded → redeemer marks its row expired" → Task 11 (`markFederationDirectoryLinkExpired`).
- Revocation / Expiry sections → Tasks 7, 9, 11, 14 (invite lazy expiry in `getFederationDirectoryInviteByRef`; no `pending`-link auto-expiry — none added).
- Origin-side step-8 pseudocode (same transaction/client, relay-attested `sender_owner_id` only, `details.reason`, pair-scoped/directional) → Task 12.
- CLI surface (`invite` create/list/revoke/redeem, `link` list/show/confirm/revoke, `route test` advisory) → Tasks 13, 14, 15.
- Observability (all `federation_directory.*` audit types, reaper reuse of `federation.forward_unavailable`/`dead_letter` with `kind`) → wired into Tasks 8, 9, 11, 13, 14.
- Data model (migration 018: both tables, all columns/constraints/indexes; `federation_outbox` `kind` + `directory_payload` + relaxed NOT NULLs + conditional CHECKs; `quota_usage` scope set) → Task 1.
- Repository methods (all 7 invite + 9 link + `getPeerByKid` + `enqueueFederationForward` extension) → Tasks 2, 6, 7, 11.
- Loop prevention / abuse / trust boundary → enforced structurally (no re-forward — unchanged from #3; receiver's active-link row is sole step-8 authority — Task 12; mutual pinning gates every route — Task 3/10; generic `INVALID_FEDERATION_INVITE` — Task 8; three rate scopes — Task 16).
- Testing section → each bullet mapped to a task's test steps; the full live-DB matrix → Task 17.
- Non-goals → nothing in the plan builds presence, OIDC-match propagation, multi-hop, auto-revoke-on-unpin, `pending`-link expiry, or link-mediated capability grants.
- Error code summary → all seven new/changed codes appear in a task (`INVALID_FEDERATION_INVITE`, `FEDERATION_LINK_NOT_FOUND`, `FEDERATION_LINK_EXISTS`, `FEDERATION_DIRECTORY_UNAVAILABLE`, plus reused `INVALID_FEDERATION_REQUEST`, `PEER_NOT_TRUSTED`, `RELAY_SIGNATURE_INVALID`, `DIRECTORY_LINK_REQUIRED`).

**Resolved design decisions (spec-author confirmed 2026-09-03 — no longer open):**
1. **Redeemer-side link row identity (Task 13, Task 11).** LOCKED: decision (b) — the `redeem` command issues the redemption POST **synchronously** and writes its `federation_directory_links` row fully populated from the `202` body's `{ link_ref, issuer }`, so the schema's `NOT NULL` + `CHECK (local_owner_id <> remote_owner_id)` hold on the first write with no sentinel and no backfill. The `federation_outbox` row is the retry fallback only when the synchronous POST fails (transport / 5xx / timeout); the reaper's `202` success branch then writes the redeemer row from the response body, idempotently. This matches Sigil's "direct call, outbox as backstop" CLI pattern.
2. **No-`federationMode` route behaviour (Task 10).** LOCKED: fail-closed — return `501 FEDERATION_DIRECTORY_UNAVAILABLE` for **both** a non-Postgres relay **and** a Postgres relay booted without `--federation-mode` (even with `--domain` set). The three directory routes never partially activate; full federation mode must be explicitly enabled. Task 10's test asserts `501` for the no-`federationMode` case.

**Placeholder scan:** no "TBD" / "handle errors appropriately" / "similar to Task N" / bare "write tests for the above" — every code step carries real code or an explicit, bounded instruction naming the exact statement to write. The two genuinely unresolved design points are called out as spec-author questions, not hand-waved.

**Type consistency:** method names are identical across tasks — `getFederationDirectoryInviteByRef`, `markFederationDirectoryInviteRedeemed`, `revokeFederationDirectoryInvite`, `createFederationDirectoryLink`, `getFederationDirectoryLinkByRef`, `setFederationDirectoryLinkConfirmation` (returns `{ updated, activated }`), `revokeFederationDirectoryLink` (`{ updated }`), `markFederationDirectoryLinkExpired` (`{ updated }`), `getActiveFederationDirectoryLink`, `listFederationDirectoryLinks`, `listFederationDirectoryInvites`, `getPeerByKid`, `verifyInboundRelayRequest` (`{ ok, originDomain, peerRecord, parsedBody }`), `buildRedemptionRequest` / `buildConfirmationRequest` / `buildRevocationRequest` (`{ body, canonicalBytes }`), `signRelayRequest` (`{ signature, keyId }`), `postDirectory` (`{ ok, status, peerCode? }`). Outbox `messageId`/`idempotencyKey` conventions are stated once (Task 14 interface block) and referenced from Task 13. `ctx` shape for the handlers is fixed: `{ repository, client, originDomain, now, request_id, relayDomain, rateLimits? }`.

---

## Execution handoff

**Plan complete and saved to `C:\dev\docs\superpowers\plans\2026-09-03-sigil-cross-federation-directory.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit here: 17 tasks, most with tight file scope and a clear test cycle; the two spec-author questions (redeemer-row identity, no-`federationMode` route) should be resolved before Tasks 10 and 13 respectively.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Chosen: Subagent-Driven (2026-09-03).** Execution to run in a fresh session via `superpowers:subagent-driven-development` — fresh subagent per task, two-stage review between tasks. Both self-review design questions are resolved and locked above; no blockers remain before Task 1. Progress ledger lives at `C:\dev\sigil-repo\.superpowers\sdd\<date>-sigil-cross-federation-directory\progress.md` once execution starts.

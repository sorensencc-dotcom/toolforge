# Sigil inter-relay routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a domain-configured relay's `RECIPIENT_NOT_LOCAL` rejection of foreign-domain envelopes with an opt-in one-hop forward to a TOFU-pinned peer relay, synchronously or via a Postgres-backed outbox drained by a new federation reaper loop.

**Architecture:** A new pure-ish `federation-router.mjs` owns the forward decision (`decideRoute`), the JCS-canonical wire body + Ed25519 relay signature (`buildForwardRequest` / `signForwardRequest`), and the outbound HTTP call (`postForward`). The origin's repository-backed accept path (`acceptWithRepository`) calls `decideRoute` where it used to call `checkRecipientLocality`; a `forward` outcome either forwards inline (`sync` mode) or writes a `federation_outbox` row (`queue` mode). A new `federation-reaper.mjs` loop claims due outbox rows with a 300s lease (`FOR UPDATE SKIP LOCKED` + `claim_token` ownership guard) and forwards them after the claim commits. The receiver adds `POST /v1/federation/envelopes` → `acceptFederatedEnvelope`, a 10-check handler that verifies the origin relay signature against its own independently-pinned peer record, verifies the sender envelope against a propagated sender key, enforces a relay-signed `sender_owner_id` same-owner exemption, then delivers through the existing local path with `federation_hop = true`. A narrow sub-project #1 amendment (`sigil init --federation-owner`) lets one owner id be shared across domains so the same-owner exemption can fire.

**Tech Stack:** Node.js ESM (`"type": "module"`), `node:test` + `node:assert/strict`, `node:crypto` Ed25519, `canonicalize` (RFC 8785 JCS, wrapped by `sigil/relay/v1/jcs.mjs`), `pg` (PostgreSQL 16), no new dependencies.

**Spec:** `C:\dev\docs\superpowers\specs\2026-08-30-sigil-inter-relay-routing-design.md` (federation sub-project #3). The #1 amendment is also recorded in that spec's "Prerequisite" section and must be back-referenced in `sigil-repo/docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md`'s revision log during Task 1.

## Global Constraints

- **Working repo:** all code changes are in `C:\dev\sigil-repo`. Run the mandatory preflight before any read/write/test/commit: `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`.
- **Branch:** create `feat/federation-inter-relay-routing` off `main` in `sigil-repo` before Task 1. Do not work on `feat/relay-well-known-generate`.
- **Test runner:** per-file `node --test <path>` from the `sigil-repo` root; full suite `npm test` (runs `node sigil-dep-audit.mjs && node sigil-jcs-audit.mjs && node --test`). Every task ends green on both the task's file and `npm test`.
- **Test style:** `import test from 'node:test'; import assert from 'node:assert/strict';`. CLI tests shell out with `execFileSync(process.execPath, [sigilCli, ...args], { cwd, encoding: 'utf8' })` and use `fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-...-test-'))` for scratch dirs, mirroring `sigil/cli/init-domain.test.mjs`.
- **Canonicalization:** always `canonicalJson` / `canonicalJsonBytes` from `sigil/relay/v1/jcs.mjs`. Never hand-roll key ordering. `canonicalJsonBytes(x)` returns a `Buffer` of `utf8` JCS text.
- **Federated ids:** parse and compare only through `sigil/relay/v1/federated-id.mjs` (`parseDomain`, `parseFederatedId`, `isLocalDomain`, `formatFederatedId`). Domain comparison is case-insensitive; port is significant.
- **Ed25519 public keys on the wire** are base64url of DER SPKI: encode with `keyObject.export({ type: 'spki', format: 'der' }).toString('base64url')`, decode with `crypto.createPublicKey({ key: Buffer.from(s, 'base64url'), format: 'der', type: 'spki' })` (see `sigil/relay/v1/well-known-document.mjs`).
- **Peer record shape** returned by `repository.getPeerByDomain(domain)` on both `createMemoryRepository` and `PostgresRepository` (camelCase, `null` when unpinned): `{ domain, relayUrl, wsUrl, keys: [{ kid, alg: 'Ed25519', publicKey }], trustMode, discoveredAt, updatedAt, lastResolvedAt }`.
- **Outbound fetch options** mirror `sigil/relay/v1/peer-discovery.mjs`'s `outboundFetchOptions()`: `{ signal: AbortSignal.timeout(5000), redirect: 'error' }`, constructed fresh per request.
- **HTTP error body shape** everywhere: `{ request_id, code, message, details }`.
- **Audit:** `repository.recordAuditEvent({ eventType, subjectId, endpointId, outcome, reason, payload, now })`. Never put the envelope body in `payload`. Memory repo exposes `_debugGetAuditEvents()` for assertions.
- **No new sender-facing API.** `sigil send` gains no flags. Sender only sees new response fields (`forwarded`, `forwarded_to`, `queued`, `duplicate`) and `FORWARD_*` codes.
- **`NODE_ENV` policy:** `http://` peer URLs are accepted when `NODE_ENV !== 'production'` (existing `isValidEndpointUrl` behavior); tests rely on this. Do not tighten it.
- **One hop is structural.** The receiver always stores `federation_hop = true` and never inspects hop depth. An inbound federated envelope is never re-submitted to `POST /v1/envelopes`.

---

## File Structure

### Created

| File | Responsibility |
|---|---|
| `sigil/relay/v1/federation-router.mjs` | Pure-ish origin-side routing: `decideRoute`, `buildForwardRequest`, `signForwardRequest`, `postForward`, `verifyRelaySignature`. No storage; takes repository + `fetchImpl` as params. |
| `sigil/relay/v1/federation-router.test.mjs` | Unit tests for the above. |
| `sigil/relay/v1/accept-federated-envelope.mjs` | Receiver-side `acceptFederatedEnvelope(body, headers, options)` — the 10-check inbound handler. |
| `sigil/relay/v1/accept-federated-envelope.test.mjs` | Unit tests for the inbound handler (memory repository). |
| `sigil/relay/v1/federation-reaper.mjs` | `runFederationReaperPass({ repository, identity, originDomain, now, fetchImpl })` and `startFederationReaper(...)` (the `setInterval` driver). |
| `sigil/relay/v1/federation-reaper.test.mjs` | Unit tests for the reaper pass with injected clock + `fetchImpl`. |
| `sigil/migrations/017_federation_outbox.sql` | `federation_outbox` table + indexes; `federation_hop boolean` columns on `envelopes` and `deliveries`. |
| `sigil/relay/v1/postgres-repository.federation-outbox.test.mjs` | Live-DB tests for the outbox repo methods, incl. the two-concurrent-claimers race. |
| `sigil/cli/sigil-federation-outbox.test.mjs` | CLI tests for `sigil federation outbox list\|show\|retry`. |
| `sigil/cli/sigil-route-test.test.mjs` | CLI tests for `sigil route test`. |
| `sigil/cli/init-federation-owner.test.mjs` | CLI tests for `sigil init --federation-owner`. |
| `sigil/cli/relay-up-federation.test.mjs` | CLI tests for the new `sigil relay up` federation flags + reaper wiring. |

### Modified

| File | Change |
|---|---|
| `sigil/cli/sigil.mjs` | `cmdInit`: add `--federation-owner`. `cmdRelayUp`: add `--federation-mode` / `--federation-identity`, load the identity, pass mode+identity+`fetchImpl` into `createRelayServer`, start `startFederationReaper` for `queue` mode. New `cmdRoute` (`route test`) and `cmdFederation` (`federation outbox …`) commands + dispatch + usage text. `startFederationReaper` import. |
| `sigil/relay/v1/validate-envelope.mjs` | `validateEnvelope`: add `skipSenderRegistration` option that skips `UNKNOWN_ENDPOINT` / `ENDPOINT_REVOKED` / sender-owner-match, keeping every other check. |
| `sigil/relay/v1/accept-envelope.mjs` | Replace the `checkRecipientLocality` call in `acceptWithRepository` with `decideRoute`; handle `local` / `reject` / `forward`; add `sync`-mode forward branch and `queue`-mode enqueue branch; new codes in `statusByCode`. |
| `sigil/relay/v1/http-server.mjs` | New `POST /v1/federation/envelopes` route → `acceptFederatedEnvelope`. Thread `federationMode`, `federationIdentity`, `fetchImpl` from `createRelayServer` options into the `/v1/envelopes` `acceptEnvelopeAsync` call. |
| `sigil/cli/memory-repository.mjs` | `persistAcceptedEnvelope`: persist `federation_hop`. Reject `queue` mode has no outbox methods — add a `_debugGetAuditEvents` already exists; no outbox methods added. |
| `sigil/relay/v1/postgres-repository.mjs` | `persistAcceptedEnvelope`: persist `federation_hop`. Add `enqueueFederationForward`, `claimDueFederationForwards`, `finalizeFederationForward`, `listFederationOutbox`, `getFederationOutboxRow`, `retryFederationForward`. `rowToFederationOutboxRecord` helper. |
| `sigil-repo/docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md` | Revision-log entry documenting the `--federation-owner` amendment (Task 1). |
| `STATUS.md`, `CHANGELOG.md` | Updated in the final task. |

---

## Task 1: `sigil init --federation-owner` (#1 amendment)

**Files:**
- Modify: `sigil/cli/sigil.mjs` — `cmdInit` (currently lines 89-111), `--help` text (line 41)
- Modify: `sigil-repo/docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md` — revision log
- Test: `sigil/cli/init-federation-owner.test.mjs` (new)

**Interfaces:**
- Consumes: `parseFederatedId`, `isLocalDomain` from `sigil/relay/v1/federated-id.mjs`; `createIdentity`/`saveIdentity` from `sigil/cli/identity.mjs`; `addEndpointToRegistry` from `sigil/cli/registry-store.mjs`; `parseArgs`/`opt` already in `sigil.mjs`.
- Produces: an identity file whose `owner_id` may carry a domain different from `--domain`, and a matching `registry.json` endpoint row. No new exported symbols. Later tasks rely on the *existence* of a shared cross-domain `owner_id` but call no new function.

**Current behavior (sigil.mjs:98-102):** an explicit `--owner` is `parseFederatedId`-checked and then forced through `isLocalDomain(owner, domain)`, throwing `OWNER_DOMAIN_MISMATCH` otherwise. An omitted `--owner` defaults to `usr_${name}@${domain}`.

- [x] **Step 1: Write the failing test**

Create `sigil/cli/init-federation-owner.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const sigilCli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sigil.mjs');
const tmpCwd = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-fedowner-test-'));
const runInit = (args, cwd) => execFileSync(process.execPath, [sigilCli, 'init', ...args], { cwd, encoding: 'utf8' });
const readIdentity = (cwd, name) => JSON.parse(fs.readFileSync(path.join(cwd, '.sigil', `${name}.identity.json`), 'utf8'));
const readRegistry = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, 'registry.json'), 'utf8'));

test('--federation-owner accepts a cross-domain owner id and writes it to identity + registry', () => {
  const cwd = tmpCwd();
  try {
    runInit(['codex', '--domain', 'a.example', '--federation-owner', 'usr_chris@primary.example', '--registry', 'registry.json'], cwd);
    const id = readIdentity(cwd, 'codex');
    assert.equal(id.endpoint_id, 'ep_codex@a.example');
    assert.equal(id.owner_id, 'usr_chris@primary.example');
    const reg = readRegistry(cwd);
    assert.equal(reg.endpoints.find((e) => e.endpoint_id === 'ep_codex@a.example').owner_id, 'usr_chris@primary.example');
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('--owner (not --federation-owner) with a foreign domain still fails OWNER_DOMAIN_MISMATCH and writes nothing', () => {
  const cwd = tmpCwd();
  try {
    assert.throws(
      () => runInit(['codex', '--domain', 'a.example', '--owner', 'usr_chris@primary.example'], cwd),
      (err) => /OWNER_DOMAIN_MISMATCH|--owner domain must match/.test(err.stderr ?? err.message),
    );
    assert.equal(fs.existsSync(path.join(cwd, '.sigil', 'codex.identity.json')), false);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('--federation-owner with a malformed federated id fails and leaves no partial identity file', () => {
  const cwd = tmpCwd();
  try {
    assert.throws(
      () => runInit(['codex', '--domain', 'a.example', '--federation-owner', 'not-a-federated-id'], cwd),
      (err) => /MALFORMED_FEDERATED_ID|federated id/.test(err.stderr ?? err.message),
    );
    assert.equal(fs.existsSync(path.join(cwd, '.sigil', 'codex.identity.json')), false);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('omitted owner still defaults to usr_<name>@<domain>', () => {
  const cwd = tmpCwd();
  try {
    runInit(['codex', '--domain', 'a.example'], cwd);
    assert.equal(readIdentity(cwd, 'codex').owner_id, 'usr_codex@a.example');
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('--federation-owner and --owner together is rejected', () => {
  const cwd = tmpCwd();
  try {
    assert.throws(
      () => runInit(['codex', '--domain', 'a.example', '--owner', 'usr_x@a.example', '--federation-owner', 'usr_chris@primary.example'], cwd),
      (err) => /both --owner and --federation-owner/.test(err.stderr ?? err.message),
    );
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/cli/init-federation-owner.test.mjs`
Expected: FAIL — `--federation-owner` is an unknown option (`parseArgs` throws) or is ignored, so the cross-domain case errors or writes `usr_codex@a.example`.

- [x] **Step 3: Implement `--federation-owner` in `cmdInit`**

In `sigil/cli/sigil.mjs`, change the `parseArgs` options in `cmdInit` to add `'federation-owner': { type: 'string' }`, then replace the owner-resolution block (currently lines 98-102):

```js
  const explicitOwner = opt(args, ['owner']);
  const federationOwner = opt(args, ['federation-owner']);
  if (explicitOwner !== undefined && federationOwner !== undefined) {
    throw new Error('sigil init: pass at most one of --owner and --federation-owner');
  }
  let owner;
  if (federationOwner !== undefined) {
    // #3 sub-project amendment: a deliberately cross-domain owner id, so one
    // owner can be shared verbatim across federated relays and the receiver's
    // same-owner exemption can fire. OWNER_DOMAIN_MISMATCH is suppressed for
    // this flag only; the id must still be a well-formed federated id.
    parseFederatedId(federationOwner);
    owner = federationOwner;
  } else if (explicitOwner !== undefined) {
    parseFederatedId(explicitOwner);
    if (!isLocalDomain(explicitOwner, domain)) throw Object.assign(new Error(`sigil init: --owner domain must match --domain`), { code: 'OWNER_DOMAIN_MISMATCH' });
    owner = explicitOwner;
  } else {
    owner = `usr_${name}@${domain}`;
  }
```

`parseFederatedId` and `isLocalDomain` are already imported in `cmdInit` via the dynamic `import('../relay/v1/federated-id.mjs')` a few lines up — keep using those bindings.

Update the usage line (sigil.mjs:41) to:

```
  init <name> [--owner <owner_id> | --federation-owner <federated_id>] [--registry path] [--domain domain]
```

The identity-file / registry writes below are unchanged — `createIdentity({ ownerId: owner, ... })`, `saveIdentity`, `addEndpointToRegistry` already fail before writing if `parseFederatedId` threw, satisfying the "no partial file" tests.

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/cli/init-federation-owner.test.mjs`
Expected: PASS (5 tests).

- [x] **Step 5: Run the existing init regression**

Run: `node --test sigil/cli/init-domain.test.mjs`
Expected: PASS — no behavior change for `--owner` / omitted owner.

- [x] **Step 6: Record the amendment in the #1 spec revision log**

Append to `sigil-repo/docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md` a revision-log entry (match that file's existing revision-log format):

> **2026-08-30 — `--federation-owner` amendment (sub-project #3 prerequisite).** `sigil init` gains `--federation-owner <federated-id>`, mutually exclusive with `--owner`. It accepts an owner id whose domain differs from `--domain`, suppressing `OWNER_DOMAIN_MISMATCH` for that invocation only. Omitted-owner default (`usr_<name>@<domain>`) and plain `--owner` domain-match enforcement are unchanged. Purpose: let one owner id be registered verbatim on two federated relays so sub-project #3's same-owner delivery exemption can fire. Adds no owner-id resolution, directory, or proof of same-principal — that is sub-project #4.

- [x] **Step 7: Commit**

```bash
git add sigil/cli/sigil.mjs sigil/cli/init-federation-owner.test.mjs docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md
git commit -m "feat(cli): add sigil init --federation-owner for shared cross-domain owner id"
```

---

## Task 2: `federation_hop` schema + persist plumbing

**Files:**
- Create: `sigil/migrations/017_federation_outbox.sql`
- Modify: `sigil/cli/memory-repository.mjs` — `persistAcceptedEnvelope` (currently lines 73-88)
- Modify: `sigil/relay/v1/postgres-repository.mjs` — `persistAcceptedEnvelope`
- Test: `sigil/relay/v1/federation-hop-persist.test.mjs` (new, memory path); Postgres coverage folded into Task 13's live-DB file

**Interfaces:**
- Consumes: nothing new.
- Produces: `persistAcceptedEnvelope(row, client?)` now reads `row.federation_hop` (boolean, default `false`) and stores it on the persisted envelope record and every delivery row it creates. `federation_outbox` table + `federation_hop` columns exist in a fresh DB. Later tasks (9, 10) set `federation_hop: true`; Task 13 uses `federation_outbox`.

- [x] **Step 1: Write the failing test**

Create `sigil/relay/v1/federation-hop-persist.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepository } from '../../cli/memory-repository.mjs';

function envelopeFixture(overrides = {}) {
  return {
    protocol: 'sigil/1', message_id: 'msg_hop_1', conversation_id: 'conv_1', message_type: 'chat.message',
    sender: { owner_id: 'usr_chris@primary.example', endpoint_id: 'ep_codex@a.example', kind: 'agent' },
    recipient: { owner_id: 'usr_chris@primary.example', endpoint_id: 'ep_claude@b.example', kind: 'agent' },
    body: { text: 'hi' }, context_refs: [], capabilities: [], idempotency_key: 'idem_1',
    created_at: '2026-08-30T12:00:00.000Z', expires_at: '2026-08-30T12:10:00.000Z',
    signature: { algorithm: 'Ed25519', key_id: 'key_ep_codex@a.example', value: 'AA' },
    ...overrides,
  };
}

test('persistAcceptedEnvelope stores federation_hop on the envelope record and delivery rows', async () => {
  const repo = createMemoryRepository({ registry: new Map() });
  const envelope = envelopeFixture();
  await repo.persistAcceptedEnvelope({ envelope, canonical_hash: 'h', message_id: envelope.message_id, federation_hop: true });
  const inbox = await repo.listInbox('ep_claude@b.example', '');
  assert.equal(inbox.length, 1);
  const stored = repo._debugGetEnvelope ? repo._debugGetEnvelope(envelope.message_id) : null;
  if (stored) assert.equal(stored.federation_hop, true);
});

test('persistAcceptedEnvelope defaults federation_hop to false', async () => {
  const repo = createMemoryRepository({ registry: new Map() });
  const envelope = envelopeFixture({ message_id: 'msg_hop_2', idempotency_key: 'idem_2' });
  const stored = await repo.persistAcceptedEnvelope({ envelope, canonical_hash: 'h', message_id: envelope.message_id });
  assert.equal(stored.duplicate, false);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/federation-hop-persist.test.mjs`
Expected: FAIL — `_debugGetEnvelope` does not exist and `federation_hop` is not stored (first test's `if (stored)` guard makes it currently vacuous; add `_debugGetEnvelope` in Step 3 so the assertion is real).

- [x] **Step 3: Implement memory-repository changes**

In `sigil/cli/memory-repository.mjs`, `persistAcceptedEnvelope` (lines 73-88): add `federation_hop` to the stored envelope row and each delivery row.

```js
    async persistAcceptedEnvelope(row) {
      const federationHop = row.federation_hop === true;
      envelopes.set(row.message_id, { ...row, federation_hop: federationHop });
      idempotency.set(`${row.envelope.sender.endpoint_id}:${row.envelope.idempotency_key}`, { message_id: row.message_id, canonical_hash: row.canonical_hash });
      if (row.envelope.recipient?.endpoint_id) {
        const deliveryId = `del_${row.message_id}`;
        deliveries.set(deliveryId, {
          delivery_id: deliveryId,
          message_id: row.message_id,
          recipient_endpoint_id: row.envelope.recipient.endpoint_id,
          state: 'delivered',
          queued_at: new Date().toISOString(),
          attempts: 0,
          federation_hop: federationHop,
        });
      }
      return { message_id: row.message_id, duplicate: false };
    },
```

Add a debug accessor next to `_debugGetAuditEvents` (end of the returned object):

```js
    _debugGetEnvelope(messageId) { return envelopes.get(messageId) ?? null; },
```

- [x] **Step 4: Implement the migration**

Create `sigil/migrations/017_federation_outbox.sql`:

```sql
-- sigil/migrations/017_federation_outbox.sql
-- Sub-project #3 (inter-relay routing).
--
-- federation_hop: a stored envelope / delivery that arrived over the
-- federated-inbound path (POST /v1/federation/envelopes). Set true by
-- acceptFederatedEnvelope; treated as a hard "never forward onward" stop by
-- decideRoute. Nullable with a false default so existing rows are unaffected.
ALTER TABLE envelopes  ADD COLUMN IF NOT EXISTS federation_hop BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS federation_hop BOOLEAN NOT NULL DEFAULT FALSE;

-- federation_outbox: queue-mode forward jobs. One row per foreign-domain
-- envelope accepted by a --federation-mode=queue relay. Drained by the
-- federation reaper (sigil/relay/v1/federation-reaper.mjs).
CREATE TABLE IF NOT EXISTS federation_outbox (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        TEXT NOT NULL,
  idempotency_key   TEXT NOT NULL,
  recipient_domain  TEXT NOT NULL,
  origin_domain     TEXT NOT NULL,
  envelope          JSONB NOT NULL,
  sender_key        JSONB NOT NULL,
  sender_owner_id   TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'pending'
                      CHECK (state IN ('pending', 'processing', 'forwarded', 'forward_rejected', 'dead_letter')),
  attempt_count     INT NOT NULL DEFAULT 0,
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at        TIMESTAMPTZ,
  claim_token       UUID,
  last_reason_code  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS federation_outbox_message_idem_uidx
  ON federation_outbox (message_id, idempotency_key);
CREATE INDEX IF NOT EXISTS federation_outbox_state_next_attempt_idx
  ON federation_outbox (state, next_attempt_at);
CREATE INDEX IF NOT EXISTS federation_outbox_state_claimed_idx
  ON federation_outbox (state, claimed_at);
```

`gen_random_uuid()` is available — `pgcrypto`/`pg_catalog` builtin is already relied on by `recordAuditEvent`-adjacent migrations; if `npm test`'s live-DB job reports it missing, prepend `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (check `001_initial.sql` first — it is already there, so no change needed).

- [x] **Step 5: Implement postgres-repository `persistAcceptedEnvelope` change**

In `sigil/relay/v1/postgres-repository.mjs`, locate `persistAcceptedEnvelope`. Add `federation_hop` to the `INSERT INTO envelopes (...)` column list and values (`$N` = `row.federation_hop === true`), and to the `INSERT INTO deliveries (...)` the same. If the method builds the envelope INSERT via a column array, append `'federation_hop'` there and the boolean to the params. Keep `ON CONFLICT` clauses unchanged.

- [x] **Step 6: Run tests**

Run: `node --test sigil/relay/v1/federation-hop-persist.test.mjs`
Expected: PASS.
Run: `npm test`
Expected: PASS. The live-DB matrix job applies `017` and every existing Postgres test still passes (new column has a default, new table is unused).

- [x] **Step 7: Commit**

```bash
git add sigil/migrations/017_federation_outbox.sql sigil/cli/memory-repository.mjs sigil/relay/v1/postgres-repository.mjs sigil/relay/v1/federation-hop-persist.test.mjs
git commit -m "feat(relay): add federation_hop columns + federation_outbox table (migration 017)"
```

---

## Task 3: `validateEnvelope` `skipSenderRegistration` option

**Files:**
- Modify: `sigil/relay/v1/validate-envelope.mjs` — `validateEnvelope` (line 62)
- Test: `sigil/relay/v1/validate-envelope.skip-sender.test.mjs` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `validateEnvelope(envelope, { ..., skipSenderRegistration })`. When `skipSenderRegistration === true`: skip the `UNKNOWN_ENDPOINT`, `ENDPOINT_REVOKED`, and `ROUTE_NOT_AUTHORIZED` (sender-owner-mismatch) checks. The caller MUST still pass a `registered` Map containing exactly one synthetic entry for `envelope.sender.endpoint_id` of shape `{ endpoint_id, owner_id, key_id, status: 'active', public_key }` so signature verification can run. Every other check (`protocol`, required fields, timestamp window, `MESSAGE_EXPIRED`, signature metadata shape, signature verification, recipient/broadcast XOR, `checkRecipientLocality`, capability coverage, idempotency-map `DUPLICATE_MESSAGE`) is unchanged. Return shape unchanged: `{ accepted, canonical_hash, endpoint_id, message_id }`.

- [x] **Step 1: Write the failing test**

Create `sigil/relay/v1/validate-envelope.skip-sender.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateEnvelope, signedBytes } from './validate-envelope.mjs';

function signedEnvelope(privateKey, keyId, overrides = {}) {
  const base = {
    protocol: 'sigil/1', message_id: 'msg_fed_1', conversation_id: 'conv_1', message_type: 'chat.message',
    sender: { owner_id: 'usr_chris@primary.example', endpoint_id: 'ep_codex@a.example', kind: 'agent' },
    recipient: { owner_id: 'usr_chris@primary.example', endpoint_id: 'ep_claude@b.example', kind: 'agent' },
    body: { text: 'hi' }, context_refs: [], capabilities: [], idempotency_key: 'idem_1',
    created_at: '2026-08-30T12:00:00.000Z', expires_at: '2026-08-30T12:10:00.000Z',
    ...overrides,
  };
  const sig = crypto.sign(null, signedBytes({ ...base, signature: undefined }), privateKey).toString('base64url');
  return { ...base, signature: { algorithm: 'Ed25519', key_id: keyId, value: sig } };
}

test('skipSenderRegistration lets an unregistered federated sender validate against a supplied key', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = 'key_ep_codex@a.example';
  const envelope = signedEnvelope(privateKey, keyId);
  const registered = new Map([[envelope.sender.endpoint_id, {
    endpoint_id: envelope.sender.endpoint_id, owner_id: envelope.sender.owner_id, key_id: keyId, status: 'active', public_key: publicKey,
  }]]);
  const result = validateEnvelope(envelope, {
    now: new Date('2026-08-30T12:00:30.000Z'), registered, relayDomain: 'b.example', skipSenderRegistration: true,
  });
  assert.equal(result.accepted, true);
});

test('without skipSenderRegistration an unregistered sender is still UNKNOWN_ENDPOINT', () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const envelope = signedEnvelope(privateKey, 'key_ep_codex@a.example');
  assert.throws(
    () => validateEnvelope(envelope, { now: new Date('2026-08-30T12:00:30.000Z'), registered: new Map(), relayDomain: 'b.example' }),
    (err) => err.code === 'UNKNOWN_ENDPOINT',
  );
});

test('skipSenderRegistration still enforces the expiry window', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = 'key_ep_codex@a.example';
  const envelope = signedEnvelope(privateKey, keyId, { created_at: '2026-08-30T12:00:00.000Z', expires_at: '2026-08-31T13:00:00.000Z' });
  const registered = new Map([[envelope.sender.endpoint_id, {
    endpoint_id: envelope.sender.endpoint_id, owner_id: envelope.sender.owner_id, key_id: keyId, status: 'active', public_key: publicKey,
  }]]);
  assert.throws(
    () => validateEnvelope(envelope, { now: new Date('2026-08-30T12:00:30.000Z'), registered, relayDomain: 'b.example', skipSenderRegistration: true }),
    (err) => err.code === 'MESSAGE_EXPIRED',
  );
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/validate-envelope.skip-sender.test.mjs`
Expected: FAIL — the first test throws `UNKNOWN_ENDPOINT` because the option is ignored (the synthetic entry IS present, so actually check: it may pass; if so, change the first test's `registered` to still trigger the owner-mismatch path by setting the synthetic entry's `owner_id` to `'usr_other@a.example'` and asserting no `ROUTE_NOT_AUTHORIZED`). Confirm at least one assertion fails before Step 3.

- [x] **Step 3: Implement the option**

In `sigil/relay/v1/validate-envelope.mjs`, add `skipSenderRegistration = false` to the destructured options of `validateEnvelope` (line 62). Replace lines 70-73:

```js
  const endpoint = registered.get(envelope.sender.endpoint_id);
  if (!skipSenderRegistration) {
    if (!endpoint) throw reject('UNKNOWN_ENDPOINT', 'Sender endpoint is not registered');
    if (endpoint.status !== 'active') throw reject('ENDPOINT_REVOKED', 'Sender endpoint is not active');
    if (endpoint.owner_id !== envelope.sender.owner_id) throw reject('ROUTE_NOT_AUTHORIZED', 'Sender owner mismatch');
  }
  if (!endpoint) throw reject('INVALID_SIGNATURE', 'Signature key is not registered for the endpoint');
```

The trailing `if (!endpoint)` keeps the function safe when a caller passes `skipSenderRegistration: true` but forgets the synthetic entry — it fails closed on signature rather than dereferencing `undefined`. Everything below (key selection at line 77, validity window, `crypto.verify`) already reads `endpoint` / `endpoint.key_id` and now works against the synthetic entry.

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/validate-envelope.skip-sender.test.mjs`
Expected: PASS.

- [x] **Step 5: Run the full validate-envelope regression**

Run: `node --test sigil/relay/v1/validate-envelope.test.mjs sigil/relay/v1/accept-envelope.test.mjs`
Expected: PASS — default `skipSenderRegistration = false` preserves every existing path.

- [x] **Step 6: Commit**

```bash
git add sigil/relay/v1/validate-envelope.mjs sigil/relay/v1/validate-envelope.skip-sender.test.mjs
git commit -m "feat(relay): add skipSenderRegistration option to validateEnvelope"
```

---

## Task 4: `federation-router.mjs` — `decideRoute`

**Files:**
- Create: `sigil/relay/v1/federation-router.mjs`
- Test: `sigil/relay/v1/federation-router.test.mjs` (new; grows in Tasks 5-7)

**Interfaces:**
- Consumes: `parseFederatedId`, `parseDomain` from `sigil/relay/v1/federated-id.mjs`; `checkRecipientLocality` from `sigil/relay/v1/validate-envelope.mjs`; `repository.getPeerByDomain`.
- Produces:
  `decideRoute(envelope, { relayDomain, federationMode, getPeerByDomain, storedFederationHop })` → `Promise<{ action: 'local' } | { action: 'reject', code, details? } | { action: 'forward', peer, recipientDomain }>`.
  - `relayDomain` falsy OR `federationMode` falsy → delegate to `checkRecipientLocality(envelope, relayDomain)` (throws `MALFORMED_FEDERATED_ID` / `RECIPIENT_NOT_LOCAL` exactly as today); if it does not throw → `{ action: 'local' }`.
  - `envelope.recipient` absent (broadcast) → `{ action: 'local' }`.
  - recipient endpoint_id not a well-formed federated id → rethrow `MALFORMED_FEDERATED_ID` (via `parseFederatedId`).
  - recipient domain equals `relayDomain` case-insensitively (port significant) → `{ action: 'local' }`.
  - `storedFederationHop === true` → `{ action: 'reject', code: 'FEDERATION_HOP_EXCEEDED' }`.
  - foreign recipient, no pinned peer → `{ action: 'reject', code: 'PEER_NOT_PINNED', details: { recipientDomain } }`.
  - foreign recipient, pinned peer → `{ action: 'forward', peer, recipientDomain }`.

- [x] **Step 1: Write the failing test**

Create `sigil/relay/v1/federation-router.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideRoute } from './federation-router.mjs';

const envelope = (recipientEndpointId) => ({
  recipient: { endpoint_id: recipientEndpointId, owner_id: 'usr_chris@primary.example', kind: 'agent' },
  sender: { endpoint_id: 'ep_codex@a.example', owner_id: 'usr_chris@primary.example', kind: 'agent' },
});
const peers = new Map([['b.example', { domain: 'b.example', relayUrl: 'https://b.example/relay', keys: [{ kid: 'k1', alg: 'Ed25519', publicKey: 'AA' }], trustMode: 'tofu' }]]);
const getPeerByDomain = async (d) => peers.get(d) ?? null;

test('no relayDomain → local', async () => {
  assert.deepEqual(await decideRoute(envelope('ep_claude@b.example'), { relayDomain: undefined, federationMode: 'sync', getPeerByDomain }), { action: 'local' });
});
test('federationMode unset → delegates to checkRecipientLocality (foreign → throws RECIPIENT_NOT_LOCAL)', async () => {
  await assert.rejects(() => decideRoute(envelope('ep_claude@b.example'), { relayDomain: 'a.example', federationMode: undefined, getPeerByDomain }), (e) => e.code === 'RECIPIENT_NOT_LOCAL');
});
test('local-domain recipient → local', async () => {
  assert.deepEqual(await decideRoute(envelope('ep_x@a.example'), { relayDomain: 'a.example', federationMode: 'sync', getPeerByDomain }), { action: 'local' });
});
test('foreign recipient, unpinned → reject PEER_NOT_PINNED', async () => {
  const r = await decideRoute(envelope('ep_z@c.example'), { relayDomain: 'a.example', federationMode: 'sync', getPeerByDomain });
  assert.equal(r.action, 'reject'); assert.equal(r.code, 'PEER_NOT_PINNED'); assert.equal(r.details.recipientDomain, 'c.example');
});
test('foreign recipient, pinned → forward with peer', async () => {
  const r = await decideRoute(envelope('ep_claude@b.example'), { relayDomain: 'a.example', federationMode: 'sync', getPeerByDomain });
  assert.equal(r.action, 'forward'); assert.equal(r.peer.relayUrl, 'https://b.example/relay'); assert.equal(r.recipientDomain, 'b.example');
});
test('malformed federated recipient → MALFORMED_FEDERATED_ID', async () => {
  await assert.rejects(() => decideRoute(envelope('ep_claude_no_domain'), { relayDomain: 'a.example', federationMode: 'sync', getPeerByDomain }), (e) => e.code === 'MALFORMED_FEDERATED_ID');
});
test('stored federation_hop true → reject FEDERATION_HOP_EXCEEDED', async () => {
  const r = await decideRoute(envelope('ep_claude@b.example'), { relayDomain: 'a.example', federationMode: 'sync', getPeerByDomain, storedFederationHop: true });
  assert.equal(r.action, 'reject'); assert.equal(r.code, 'FEDERATION_HOP_EXCEEDED');
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: FAIL — `federation-router.mjs` does not exist.

- [x] **Step 3: Implement `decideRoute`**

Create `sigil/relay/v1/federation-router.mjs`:

```js
import { parseFederatedId } from './federated-id.mjs';
import { checkRecipientLocality, reject } from './validate-envelope.mjs';

// Origin-side routing decision (design §"New module"). Async only because the
// pinned-peer lookup is a repository call; every other branch is pure string
// work. The accept transaction awaits this in place of checkRecipientLocality.
export async function decideRoute(envelope, { relayDomain, federationMode, getPeerByDomain, storedFederationHop = false } = {}) {
  if (!envelope?.recipient) return { action: 'local' };

  // Routing disabled: preserve today's exact behavior. checkRecipientLocality
  // throws MALFORMED_FEDERATED_ID / RECIPIENT_NOT_LOCAL or returns silently.
  if (!relayDomain || !federationMode) {
    checkRecipientLocality(envelope, relayDomain);
    return { action: 'local' };
  }

  let recipientId;
  try {
    recipientId = parseFederatedId(envelope.recipient.endpoint_id);
  } catch {
    throw reject('MALFORMED_FEDERATED_ID', `recipient.endpoint_id "${envelope.recipient.endpoint_id}" is not a well-formed federated id, required by this relay's --domain configuration`, { recipient_endpoint_id: envelope.recipient.endpoint_id });
  }

  if (recipientId.domain.toLowerCase() === String(relayDomain).toLowerCase()) {
    return { action: 'local' };
  }

  // Defense-in-depth: decideRoute is not normally reached for a stored
  // federated-inbound envelope (it is delivered straight to a local inbox and
  // never re-submitted as an authenticated local send), but if a future path
  // ever routes one, stop it here.
  if (storedFederationHop === true) {
    return { action: 'reject', code: 'FEDERATION_HOP_EXCEEDED', details: { recipientDomain: recipientId.domain } };
  }

  const peer = await getPeerByDomain(recipientId.domain);
  if (!peer) {
    return { action: 'reject', code: 'PEER_NOT_PINNED', details: { recipientDomain: recipientId.domain } };
  }
  return { action: 'forward', peer, recipientDomain: recipientId.domain };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add sigil/relay/v1/federation-router.mjs sigil/relay/v1/federation-router.test.mjs
git commit -m "feat(relay): add federation-router decideRoute"
```

---

## Task 5: `federation-router.mjs` — `buildForwardRequest` + `signForwardRequest`

**Files:**
- Modify: `sigil/relay/v1/federation-router.mjs`
- Modify: `sigil/relay/v1/federation-router.test.mjs`

**Interfaces:**
- Consumes: `canonicalJson`, `canonicalJsonBytes` from `sigil/relay/v1/jcs.mjs`; `node:crypto`.
- Produces:
  `buildForwardRequest(envelope, { originDomain, senderKey, senderOwnerId, now })` → `{ body, canonicalBytes }`. `body` is the wire object `{ origin_domain, envelope, sender_key: { kid, alg, publicKey }, sender_owner_id, forwarded_at }` with `forwarded_at` = `now` as an ISO string. `canonicalBytes` = `canonicalJsonBytes(body)` (a `Buffer`). Pure, no I/O. **`canonicalBytes` is the single source of truth** — callers send it verbatim as the HTTP body and pass it verbatim to `signForwardRequest`; they never re-serialize `body`.
  `signForwardRequest(canonicalBytes, identity)` → `{ signature, keyId }`. `identity` is the parsed `sigil init` identity object (`{ key_id, private_key_pem, ... }`). `signature` = base64url Ed25519 over `canonicalBytes`; `keyId` = `identity.key_id`.

- [x] **Step 1: Write the failing test**

Append to `sigil/relay/v1/federation-router.test.mjs`:

```js
import crypto from 'node:crypto';
import { buildForwardRequest, signForwardRequest } from './federation-router.mjs';
import { canonicalJsonBytes } from './jcs.mjs';

const senderEnvelope = {
  protocol: 'sigil/1', message_id: 'msg_1', conversation_id: 'conv_1', message_type: 'chat.message',
  sender: { owner_id: 'usr_chris@primary.example', endpoint_id: 'ep_codex@a.example', kind: 'agent' },
  recipient: { owner_id: 'usr_chris@primary.example', endpoint_id: 'ep_claude@b.example', kind: 'agent' },
  body: { text: 'hi' }, context_refs: [], capabilities: [], idempotency_key: 'idem_1',
  created_at: '2026-08-30T12:00:00.000Z', expires_at: '2026-08-30T12:10:00.000Z',
  signature: { algorithm: 'Ed25519', key_id: 'key_ep_codex@a.example', value: 'ZZ' },
};

test('buildForwardRequest: canonicalBytes equals JCS of body and carries forwarded_at', () => {
  const now = new Date('2026-08-30T12:00:05.000Z');
  const { body, canonicalBytes } = buildForwardRequest(senderEnvelope, {
    originDomain: 'a.example', senderKey: { kid: 'key_ep_codex@a.example', alg: 'Ed25519', publicKey: 'PUB' },
    senderOwnerId: 'usr_chris@primary.example', now,
  });
  assert.equal(body.origin_domain, 'a.example');
  assert.equal(body.sender_owner_id, 'usr_chris@primary.example');
  assert.equal(body.forwarded_at, '2026-08-30T12:00:05.000Z');
  assert.deepEqual(body.envelope, senderEnvelope);
  assert.ok(Buffer.isBuffer(canonicalBytes));
  assert.equal(canonicalBytes.toString('utf8'), canonicalJsonBytes(body).toString('utf8'));
});

test('signForwardRequest: verifies against identity public key over canonicalBytes', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const identity = { key_id: 'key_ep_codex@a.example', private_key_pem: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const { canonicalBytes } = buildForwardRequest(senderEnvelope, {
    originDomain: 'a.example', senderKey: { kid: identity.key_id, alg: 'Ed25519', publicKey: 'PUB' },
    senderOwnerId: 'usr_chris@primary.example', now: new Date('2026-08-30T12:00:05.000Z'),
  });
  const { signature, keyId } = signForwardRequest(canonicalBytes, identity);
  assert.equal(keyId, 'key_ep_codex@a.example');
  assert.equal(crypto.verify(null, canonicalBytes, publicKey, Buffer.from(signature, 'base64url')), true);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: FAIL — `buildForwardRequest` / `signForwardRequest` not exported.

- [x] **Step 3: Implement**

Append to `sigil/relay/v1/federation-router.mjs`:

```js
import crypto from 'node:crypto';
import { canonicalJsonBytes } from './jcs.mjs';

export function buildForwardRequest(envelope, { originDomain, senderKey, senderOwnerId, now } = {}) {
  const body = {
    origin_domain: originDomain,
    envelope,
    sender_key: { kid: senderKey.kid, alg: senderKey.alg ?? 'Ed25519', publicKey: senderKey.publicKey },
    sender_owner_id: senderOwnerId,
    forwarded_at: (now instanceof Date ? now : new Date(now)).toISOString(),
  };
  return { body, canonicalBytes: canonicalJsonBytes(body) };
}

export function signForwardRequest(canonicalBytes, identity) {
  const privateKey = crypto.createPrivateKey(identity.private_key_pem);
  const signature = crypto.sign(null, canonicalBytes, privateKey).toString('base64url');
  return { signature, keyId: identity.key_id };
}
```

Move the `import crypto` and `import { canonicalJsonBytes }` lines to the top of the file with the other imports (do not leave mid-file imports).

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add sigil/relay/v1/federation-router.mjs sigil/relay/v1/federation-router.test.mjs
git commit -m "feat(relay): add buildForwardRequest + signForwardRequest to federation-router"
```

---

## Task 6: `federation-router.mjs` — `postForward`

**Files:**
- Modify: `sigil/relay/v1/federation-router.mjs`
- Modify: `sigil/relay/v1/federation-router.test.mjs`

**Interfaces:**
- Consumes: global `fetch` (overridable via `fetchImpl`).
- Produces:
  `postForward(peer, canonicalBytes, { signature, keyId }, { fetchImpl = fetch } = {})` → `Promise<{ ok, status, peerCode? }>`.
  - `POST` to `new URL('/v1/federation/envelopes', peer.relayUrl).toString()` — always `peer.relayUrl`, never any envelope field.
  - Options: `{ method: 'POST', body: canonicalBytes, redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'content-type': 'application/json', 'Sigil-Relay-Signature': signature, 'Sigil-Relay-Key-Id': keyId } }`.
  - `res.status` 2xx → `{ ok: true, status }`.
  - `res.status` 4xx → `{ ok: false, status, peerCode? }`. `peerCode` is set only when the body reads (with a 4 KiB cap) as JSON whose `code` is a string matching `/^[A-Z][A-Z0-9_]{0,63}$/`. Otherwise `peerCode` is omitted and raw peer text is never returned or logged.
  - timeout / transport error / `res.status` 5xx → throw `Object.assign(new Error(...), { code: 'FORWARD_TRANSPORT_FAILED' })`.

- [x] **Step 1: Write the failing test**

Append to `sigil/relay/v1/federation-router.test.mjs`:

```js
import { postForward } from './federation-router.mjs';

const peer = { relayUrl: 'https://b.example/relay' };
const bytes = Buffer.from('{"x":1}', 'utf8');
const sig = { signature: 'SIG', keyId: 'k1' };
const res = ({ status, body = '', json }) => ({
  status, ok: status >= 200 && status < 300,
  text: async () => body,
  json: async () => (json ?? JSON.parse(body)),
});

test('2xx → ok:true and target URL is peer.relayUrl', async () => {
  let seenUrl, seenOpts;
  const fetchImpl = async (url, opts) => { seenUrl = url; seenOpts = opts; return res({ status: 202 }); };
  const out = await postForward(peer, bytes, sig, { fetchImpl });
  assert.deepEqual(out, { ok: true, status: 202 });
  assert.equal(String(seenUrl), 'https://b.example/relay/v1/federation/envelopes');
  assert.equal(seenOpts.redirect, 'error');
  assert.equal(seenOpts.headers['Sigil-Relay-Signature'], 'SIG');
  assert.equal(seenOpts.headers['Sigil-Relay-Key-Id'], 'k1');
});
test('4xx with well-formed { code } → ok:false + peerCode', async () => {
  const fetchImpl = async () => res({ status: 403, body: JSON.stringify({ code: 'DIRECTORY_LINK_REQUIRED', message: 'nope' }) });
  assert.deepEqual(await postForward(peer, bytes, sig, { fetchImpl }), { ok: false, status: 403, peerCode: 'DIRECTORY_LINK_REQUIRED' });
});
test('4xx with non-JSON body → ok:false, peerCode omitted', async () => {
  const fetchImpl = async () => res({ status: 400, body: '<html>bad</html>' });
  assert.deepEqual(await postForward(peer, bytes, sig, { fetchImpl }), { ok: false, status: 400 });
});
test('4xx with a code that fails the shape regex → peerCode omitted', async () => {
  const fetchImpl = async () => res({ status: 400, body: JSON.stringify({ code: 'not-a-code' }) });
  assert.deepEqual(await postForward(peer, bytes, sig, { fetchImpl }), { ok: false, status: 400 });
});
test('4xx body over 4 KiB → peerCode omitted', async () => {
  const big = JSON.stringify({ code: 'REAL_CODE', pad: 'x'.repeat(5000) });
  const fetchImpl = async () => res({ status: 400, body: big });
  assert.deepEqual(await postForward(peer, bytes, sig, { fetchImpl }), { ok: false, status: 400 });
});
test('5xx → throws FORWARD_TRANSPORT_FAILED', async () => {
  const fetchImpl = async () => res({ status: 503, body: 'nope' });
  await assert.rejects(() => postForward(peer, bytes, sig, { fetchImpl }), (e) => e.code === 'FORWARD_TRANSPORT_FAILED');
});
test('fetch rejection (timeout/transport) → throws FORWARD_TRANSPORT_FAILED', async () => {
  const fetchImpl = async () => { throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }); };
  await assert.rejects(() => postForward(peer, bytes, sig, { fetchImpl }), (e) => e.code === 'FORWARD_TRANSPORT_FAILED');
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: FAIL — `postForward` not exported.

- [x] **Step 3: Implement**

Append to `sigil/relay/v1/federation-router.mjs`:

```js
const PEER_CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const PEER_BODY_READ_CAP = 4 * 1024;

export async function postForward(peer, canonicalBytes, { signature, keyId }, { fetchImpl = fetch } = {}) {
  const url = new URL('/v1/federation/envelopes', peer.relayUrl).toString();
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      body: canonicalBytes,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        'content-type': 'application/json',
        'Sigil-Relay-Signature': signature,
        'Sigil-Relay-Key-Id': keyId,
      },
    });
  } catch (error) {
    throw Object.assign(new Error(`forward transport failed: ${error.message}`), { code: 'FORWARD_TRANSPORT_FAILED', cause: error });
  }

  if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
  if (res.status >= 500) {
    throw Object.assign(new Error(`peer relay returned ${res.status}`), { code: 'FORWARD_TRANSPORT_FAILED', status: res.status });
  }
  // 4xx: attempt a bounded, shape-checked read of the peer's error code.
  let peerCode;
  try {
    const text = await res.text();
    if (typeof text === 'string' && text.length <= PEER_BODY_READ_CAP) {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.code === 'string' && PEER_CODE_RE.test(parsed.code)) peerCode = parsed.code;
    }
  } catch { /* non-JSON / oversize / read error: peerCode stays undefined */ }
  return peerCode ? { ok: false, status: res.status, peerCode } : { ok: false, status: res.status };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add sigil/relay/v1/federation-router.mjs sigil/relay/v1/federation-router.test.mjs
git commit -m "feat(relay): add postForward with bounded peer-code parsing to federation-router"
```

---

## Task 7: `federation-router.mjs` — `verifyRelaySignature`

**Files:**
- Modify: `sigil/relay/v1/federation-router.mjs`
- Modify: `sigil/relay/v1/federation-router.test.mjs`

**Interfaces:**
- Consumes: `node:crypto`; `canonicalJsonBytes` from `jcs.mjs`.
- Produces:
  `verifyRelaySignature(parsedBody, { signature, keyId, peer })` → `boolean`.
  - Re-canonicalizes `parsedBody` with `canonicalJsonBytes` (never trusts received byte order).
  - Finds the peer key entry where `entry.kid === keyId`. If none → `false`.
  - Parses `entry.publicKey` as base64url DER SPKI. On parse failure → `false`.
  - Returns `crypto.verify(null, canonicalBytes, publicKey, Buffer.from(signature, 'base64url'))`.
  - Any thrown error (bad base64url, malformed key) is caught → `false` (fail closed).

- [x] **Step 1: Write the failing test**

Append to `sigil/relay/v1/federation-router.test.mjs`:

```js
import { verifyRelaySignature } from './federation-router.mjs';
import { canonicalJsonBytes } from './jcs.mjs';

function keyEntry(kid, publicKeyObj) {
  return { kid, alg: 'Ed25519', publicKey: publicKeyObj.export({ type: 'spki', format: 'der' }).toString('base64url') };
}

test('verifyRelaySignature: valid signature over canonical bytes verifies after re-canonicalization', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const body = { b: 2, a: 1 }; // deliberately non-canonical key order
  const signature = crypto.sign(null, canonicalJsonBytes(body), privateKey).toString('base64url');
  const peer = { keys: [keyEntry('k1', publicKey)] };
  assert.equal(verifyRelaySignature(body, { signature, keyId: 'k1', peer }), true);
});
test('tampered body → false', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const signature = crypto.sign(null, canonicalJsonBytes({ a: 1 }), privateKey).toString('base64url');
  assert.equal(verifyRelaySignature({ a: 2 }, { signature, keyId: 'k1', peer: { keys: [keyEntry('k1', publicKey)] } }), false);
});
test('unknown keyId → false', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const signature = crypto.sign(null, canonicalJsonBytes({ a: 1 }), privateKey).toString('base64url');
  assert.equal(verifyRelaySignature({ a: 1 }, { signature, keyId: 'nope', peer: { keys: [keyEntry('k1', publicKey)] } }), false);
});
test('kid reused with a swapped publicKey → false', () => {
  const a = crypto.generateKeyPairSync('ed25519');
  const b = crypto.generateKeyPairSync('ed25519');
  const signature = crypto.sign(null, canonicalJsonBytes({ a: 1 }), a.privateKey).toString('base64url');
  assert.equal(verifyRelaySignature({ a: 1 }, { signature, keyId: 'k1', peer: { keys: [keyEntry('k1', b.publicKey)] } }), false);
});
test('signature made over non-canonical bytes → false', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const badBytes = Buffer.from(JSON.stringify({ b: 2, a: 1 }), 'utf8'); // not JCS-ordered
  const signature = crypto.sign(null, badBytes, privateKey).toString('base64url');
  assert.equal(verifyRelaySignature({ b: 2, a: 1 }, { signature, keyId: 'k1', peer: { keys: [keyEntry('k1', publicKey)] } }), false);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: FAIL — `verifyRelaySignature` not exported.

- [x] **Step 3: Implement**

Append to `sigil/relay/v1/federation-router.mjs`:

```js
export function verifyRelaySignature(parsedBody, { signature, keyId, peer } = {}) {
  try {
    const entry = (peer?.keys ?? []).find((k) => k.kid === keyId);
    if (!entry) return false;
    const publicKey = crypto.createPublicKey({ key: Buffer.from(entry.publicKey, 'base64url'), format: 'der', type: 'spki' });
    return crypto.verify(null, canonicalJsonBytes(parsedBody), publicKey, Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/federation-router.test.mjs`
Expected: PASS (all tasks 4-7 tests green).

- [x] **Step 5: Commit**

```bash
git add sigil/relay/v1/federation-router.mjs sigil/relay/v1/federation-router.test.mjs
git commit -m "feat(relay): add verifyRelaySignature (canonicalize-after-parse, fail closed)"
```

---

## Task 8: `acceptFederatedEnvelope` — checks 1-5 (structural, trust, relay sig, sender domain, envelope sig)

**Files:**
- Create: `sigil/relay/v1/accept-federated-envelope.mjs`
- Test: `sigil/relay/v1/accept-federated-envelope.test.mjs` (new; grows in Task 9)

**Interfaces:**
- Consumes: `parseDomain`, `parseFederatedId` from `federated-id.mjs`; `verifyRelaySignature` from `federation-router.mjs`; `validateEnvelope`, `signedBytes`, `reject` from `validate-envelope.mjs`; `repository.getPeerByDomain`.
- Produces:
  `acceptFederatedEnvelope(body, headers, options)` → `Promise<{ status, body }>` using the `{ request_id, code, message, details }` shape. `options`: `{ repository, registered, relayDomain, request_id, now }`. `headers` is a plain lowercased-key object; the handler reads `headers['sigil-relay-signature']` and `headers['sigil-relay-key-id']`.
  Task 8 implements checks 1-5 and returns `{ status: 202, body: { request_id, code: 'ACCEPTED_STUB' } }` on reaching check 6 (replaced in Task 9). Error returns:
  1. `400 INVALID_FEDERATION_REQUEST` — bad `origin_domain` / `envelope` / `sender_key` / `sender_owner_id`.
  2. `403 PEER_NOT_TRUSTED` — `getPeerByDomain(origin_domain)` is null.
  3. `401 RELAY_SIGNATURE_INVALID` — `verifyRelaySignature` false.
  4. `403 SENDER_DOMAIN_FOREIGN` — `parseFederatedId(envelope.sender.endpoint_id).domain` ≠ `origin_domain` (case-insensitive).
  5. `401 INVALID_SIGNATURE` — `envelope.signature` fails against `sender_key.publicKey`.

- [x] **Step 1: Write the failing test**

Create `sigil/relay/v1/accept-federated-envelope.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { acceptFederatedEnvelope } from './accept-federated-envelope.mjs';
import { signedBytes } from './validate-envelope.mjs';
import { buildForwardRequest, signForwardRequest } from './federation-router.mjs';
import { canonicalJsonBytes } from './jcs.mjs';
import { createMemoryRepository } from '../../cli/memory-repository.mjs';

const ORIGIN = 'a.example';
const RELAY = 'b.example';

function makeWorld() {
  const relayKeys = crypto.generateKeyPairSync('ed25519');
  const senderKeys = crypto.generateKeyPairSync('ed25519');
  const relayIdentity = { key_id: 'relay-a-2026-08', private_key_pem: relayKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const relayPub = relayKeys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  const senderPub = senderKeys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  const repo = createMemoryRepository({ registry: new Map() });
  repo.upsertPeer({ domain: ORIGIN, relayUrl: 'https://a.example/relay', keys: [{ kid: relayIdentity.key_id, alg: 'Ed25519', publicKey: relayPub }], trustMode: 'tofu' });
  return { relayKeys, senderKeys, relayIdentity, relayPub, senderPub, repo };
}

function senderEnvelope(senderPrivateKey, overrides = {}) {
  const base = {
    protocol: 'sigil/1', message_id: 'msg_fed_1', conversation_id: 'conv_1', message_type: 'chat.message',
    sender: { owner_id: 'usr_chris@primary.example', endpoint_id: `ep_codex@${ORIGIN}`, kind: 'agent' },
    recipient: { owner_id: 'usr_chris@primary.example', endpoint_id: `ep_claude@${RELAY}`, kind: 'agent' },
    body: { text: 'hi' }, context_refs: [], capabilities: [], idempotency_key: 'idem_1',
    created_at: '2026-08-30T12:00:00.000Z', expires_at: '2026-08-30T12:10:00.000Z',
    ...overrides,
  };
  const value = crypto.sign(null, signedBytes({ ...base, signature: undefined }), senderPrivateKey).toString('base64url');
  return { ...base, signature: { algorithm: 'Ed25519', key_id: `key_ep_codex@${ORIGIN}`, value } };
}

function forwardPayload(world, envelopeOverrides = {}, opts = {}) {
  const envelope = opts.envelope ?? senderEnvelope(world.senderKeys.privateKey, envelopeOverrides);
  const { body, canonicalBytes } = buildForwardRequest(envelope, {
    originDomain: opts.originDomain ?? ORIGIN,
    senderKey: { kid: `key_ep_codex@${ORIGIN}`, alg: 'Ed25519', publicKey: opts.senderPub ?? world.senderPub },
    senderOwnerId: opts.senderOwnerId ?? 'usr_chris@primary.example',
    now: new Date('2026-08-30T12:00:05.000Z'),
  });
  const { signature, keyId } = signForwardRequest(canonicalBytes, opts.relayIdentity ?? world.relayIdentity);
  return { body, headers: { 'sigil-relay-signature': signature, 'sigil-relay-key-id': keyId } };
}

const baseOpts = (repo) => ({ repository: repo, registered: new Map(), relayDomain: RELAY, request_id: 'req_1', now: new Date('2026-08-30T12:00:30.000Z') });

test('check 1: structural garbage → 400 INVALID_FEDERATION_REQUEST', async () => {
  const world = makeWorld();
  const r = await acceptFederatedEnvelope({ origin_domain: 'not a domain', envelope: null }, {}, baseOpts(world.repo));
  assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_FEDERATION_REQUEST');
});
test('check 1: malformed sender_owner_id → 400 INVALID_FEDERATION_REQUEST', async () => {
  const world = makeWorld();
  const { body, headers } = forwardPayload(world, {}, { senderOwnerId: 'no-domain' });
  const r = await acceptFederatedEnvelope(body, headers, baseOpts(world.repo));
  assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_FEDERATION_REQUEST');
});
test('check 2: unpinned origin → 403 PEER_NOT_TRUSTED', async () => {
  const world = makeWorld();
  const { body, headers } = forwardPayload(world, {}, { originDomain: 'c.example' });
  const r = await acceptFederatedEnvelope(body, headers, baseOpts(world.repo));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'PEER_NOT_TRUSTED');
});
test('check 3: bad relay signature → 401 RELAY_SIGNATURE_INVALID', async () => {
  const world = makeWorld();
  const { body, headers } = forwardPayload(world);
  const r = await acceptFederatedEnvelope(body, { ...headers, 'sigil-relay-signature': 'AAAA' }, baseOpts(world.repo));
  assert.equal(r.status, 401); assert.equal(r.body.code, 'RELAY_SIGNATURE_INVALID');
});
test('check 4: sender domain ≠ origin_domain → 403 SENDER_DOMAIN_FOREIGN', async () => {
  const world = makeWorld();
  const envelope = senderEnvelope(world.senderKeys.privateKey, { sender: { owner_id: 'usr_chris@primary.example', endpoint_id: 'ep_codex@evil.example', kind: 'agent' } });
  const { body, headers } = forwardPayload(world, {}, { envelope });
  const r = await acceptFederatedEnvelope(body, headers, baseOpts(world.repo));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'SENDER_DOMAIN_FOREIGN');
});
test('check 5: envelope signature not matching sender_key → 401 INVALID_SIGNATURE', async () => {
  const world = makeWorld();
  const other = crypto.generateKeyPairSync('ed25519');
  const { body, headers } = forwardPayload(world, {}, { senderPub: other.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url') });
  const r = await acceptFederatedEnvelope(body, headers, baseOpts(world.repo));
  assert.equal(r.status, 401); assert.equal(r.body.code, 'INVALID_SIGNATURE');
});
test('checks 1-5 pass → reaches the stub (replaced in Task 9)', async () => {
  const world = makeWorld();
  const { body, headers } = forwardPayload(world);
  const r = await acceptFederatedEnvelope(body, headers, baseOpts(world.repo));
  assert.notEqual(r.status, 400);
  assert.notEqual(r.status, 401);
  assert.notEqual(r.status, 403);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement checks 1-5**

Create `sigil/relay/v1/accept-federated-envelope.mjs`:

```js
import crypto from 'node:crypto';
import { parseDomain, parseFederatedId } from './federated-id.mjs';
import { verifyRelaySignature } from './federation-router.mjs';
import { signedBytes } from './validate-envelope.mjs';

function respond(status, code, message, options, details = {}) {
  return { status, body: { request_id: options.request_id ?? null, code, message, details } };
}

function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }

// POST /v1/federation/envelopes handler (design §"Receiving side"). Runs the
// checks in order; the first failure returns immediately.
export async function acceptFederatedEnvelope(body, headers, options) {
  const { repository } = options;

  // --- Check 1: structural ---
  if (!body || typeof body !== 'object') return respond(400, 'INVALID_FEDERATION_REQUEST', 'Request body must be an object', options);
  const { origin_domain: originDomain, envelope, sender_key: senderKey, sender_owner_id: senderOwnerId } = body;
  try { parseDomain(originDomain); } catch { return respond(400, 'INVALID_FEDERATION_REQUEST', 'origin_domain is not a well-formed domain', options); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return respond(400, 'INVALID_FEDERATION_REQUEST', 'envelope must be an object', options);
  if (!senderKey || !isNonEmptyString(senderKey.kid) || senderKey.alg !== 'Ed25519' || !isNonEmptyString(senderKey.publicKey)) {
    return respond(400, 'INVALID_FEDERATION_REQUEST', 'sender_key must be { kid, alg: "Ed25519", publicKey }', options);
  }
  try { parseFederatedId(senderOwnerId); } catch { return respond(400, 'INVALID_FEDERATION_REQUEST', 'sender_owner_id is not a well-formed federated id', options); }

  // --- Check 2: origin pinned (receiver's own peer directory) ---
  const peer = await repository.getPeerByDomain(originDomain);
  if (!peer) return respond(403, 'PEER_NOT_TRUSTED', 'Origin domain is not pinned in this relay\'s peer directory', options, { origin_domain: originDomain });

  // --- Check 3: relay signature over the JCS body bytes ---
  const relaySignature = headers['sigil-relay-signature'];
  const relayKeyId = headers['sigil-relay-key-id'];
  if (!isNonEmptyString(relaySignature) || !isNonEmptyString(relayKeyId) || !verifyRelaySignature(body, { signature: relaySignature, keyId: relayKeyId, peer })) {
    return respond(401, 'RELAY_SIGNATURE_INVALID', 'Sigil-Relay-Signature failed verification against the pinned peer key', options);
  }

  // --- Check 4: sender domain === origin_domain ---
  let senderDomain;
  try { senderDomain = parseFederatedId(envelope.sender?.endpoint_id).domain; }
  catch { return respond(400, 'INVALID_FEDERATION_REQUEST', 'envelope.sender.endpoint_id is not a well-formed federated id', options); }
  if (senderDomain.toLowerCase() !== originDomain.toLowerCase()) {
    return respond(403, 'SENDER_DOMAIN_FOREIGN', 'envelope.sender domain does not equal origin_domain', options, { sender_domain: senderDomain, origin_domain: originDomain });
  }

  // --- Check 5: envelope signature against the propagated sender key ---
  let ok = false;
  try {
    const senderPub = crypto.createPublicKey({ key: Buffer.from(senderKey.publicKey, 'base64url'), format: 'der', type: 'spki' });
    const sig = Buffer.from(envelope.signature?.value ?? '', 'base64url');
    ok = sig.length > 0 && crypto.verify(null, signedBytes(envelope), senderPub, sig);
  } catch { ok = false; }
  if (!ok) return respond(401, 'INVALID_SIGNATURE', 'Envelope signature verification failed against sender_key', options);

  // --- Checks 6-10 land in Task 9 ---
  return { status: 202, body: { request_id: options.request_id ?? null, code: 'ACCEPTED_STUB' } };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add sigil/relay/v1/accept-federated-envelope.mjs sigil/relay/v1/accept-federated-envelope.test.mjs
git commit -m "feat(relay): acceptFederatedEnvelope checks 1-5 (structural, trust, sigs)"
```

---

## Task 9: `acceptFederatedEnvelope` — checks 6-10 (validate, owner exemption, deliver)

**Files:**
- Modify: `sigil/relay/v1/accept-federated-envelope.mjs`
- Modify: `sigil/relay/v1/accept-federated-envelope.test.mjs`
- Modify: `sigil/cli/memory-repository.mjs` — add `lookupRecipientEndpoint` already exists (line 69); confirm it returns `{ endpoint_id, owner_id, status }`. If it does not return `owner_id`, extend it.

**Interfaces:**
- Consumes: `validateEnvelope` (with `skipSenderRegistration: true` from Task 3); `repository.lookupAcceptedMessageId`, `repository.lookupIdempotency`, `repository.lookupRecipientEndpoint`, `repository.reserveRateLimit`, `repository.countOpenDeliveries`, `repository.persistAcceptedEnvelope`, `repository.recordAuditEvent`, `repository.withTransaction`; `resolveRateLimits`, `DEFAULT_INBOX_DEPTH_LIMIT` from `relay-config.mjs`.
- Produces: `acceptFederatedEnvelope` now runs checks 6-10 and returns `202 { code: 'ACCEPTED', message_id, duplicate }`. New error returns:
  6. `422 MESSAGE_EXPIRED` / `409 REPLAY_DETECTED` / `400 INVALID_ENVELOPE` from `validateEnvelope`; `403 SENDER_OWNER_ASSERTION_MISMATCH` when `envelope.sender.owner_id !== sender_owner_id`.
  7. `400 RECIPIENT_NOT_FOUND` — recipient endpoint absent/inactive.
  8. `403 DIRECTORY_LINK_REQUIRED` — relay-attested `sender_owner_id` ≠ recipient's registry `owner_id`.
  9. `429 RATE_LIMITED` / `429 QUOTA_EXCEEDED` — reservations incl. new `['federation_origin', origin_domain]` scope + inbox-depth cap.
  10. `202 ACCEPTED` `{ duplicate: false }`; a re-POST resolving to an accepted `(sender.endpoint_id, idempotency_key)` → `202 { duplicate: true }` with the original `message_id`, no second delivery.
  Audit: `federation.inbound_accepted` on success, `federation.inbound_rejected` (with `reason` = failing code) on every non-2xx from checks 2-10.

- [x] **Step 1: Write the failing test**

Append to `sigil/relay/v1/accept-federated-envelope.test.mjs` (reuses `makeWorld` / `forwardPayload` / `baseOpts` / `senderEnvelope` from Task 8; register the recipient in the world's memory repo):

```js
import { signedBytes as _sb } from './validate-envelope.mjs'; // already imported above; keep single import

function registerRecipient(repo, { endpointId = `ep_claude@${RELAY}`, ownerId = 'usr_chris@primary.example' } = {}) {
  // memory-repository.lookupRecipientEndpoint reads the registry Map passed at
  // creation; re-create the repo with the recipient present instead.
  return { endpointId, ownerId };
}

function worldWithRecipient(recipientOwnerId = 'usr_chris@primary.example') {
  const registry = new Map([[`ep_claude@${RELAY}`, { endpoint_id: `ep_claude@${RELAY}`, owner_id: recipientOwnerId, key_id: `key_ep_claude@${RELAY}`, kind: 'agent', status: 'active', public_key: crypto.generateKeyPairSync('ed25519').publicKey }]]);
  const relayKeys = crypto.generateKeyPairSync('ed25519');
  const senderKeys = crypto.generateKeyPairSync('ed25519');
  const relayIdentity = { key_id: 'relay-a-2026-08', private_key_pem: relayKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const relayPub = relayKeys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  const senderPub = senderKeys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  const repo = createMemoryRepository({ registry });
  repo.upsertPeer({ domain: ORIGIN, relayUrl: 'https://a.example/relay', keys: [{ kid: relayIdentity.key_id, alg: 'Ed25519', publicKey: relayPub }], trustMode: 'tofu' });
  return { relayKeys, senderKeys, relayIdentity, relayPub, senderPub, repo, registered: registry };
}
const opts9 = (world) => ({ repository: world.repo, registered: world.registered, relayDomain: RELAY, request_id: 'req_1', now: new Date('2026-08-30T12:00:30.000Z') });

test('same-owner exemption: relay-attested owner == recipient registry owner → 202 delivered, federation_hop stored', async () => {
  const world = worldWithRecipient('usr_chris@primary.example');
  const { body, headers } = forwardPayload(world);
  const r = await acceptFederatedEnvelope(body, headers, opts9(world));
  assert.equal(r.status, 202); assert.equal(r.body.code, 'ACCEPTED'); assert.equal(r.body.duplicate, false);
  const inbox = await world.repo.listInbox(`ep_claude@${RELAY}`, '');
  assert.equal(inbox.length, 1);
  assert.equal(world.repo._debugGetEnvelope(inbox[0].message_id).federation_hop, true);
  assert.ok(world.repo._debugGetAuditEvents().some((e) => e.event_type === 'federation.inbound_accepted'));
});
test('cross-owner → 403 DIRECTORY_LINK_REQUIRED', async () => {
  const world = worldWithRecipient('usr_someone_else@b.example');
  const { body, headers } = forwardPayload(world);
  const r = await acceptFederatedEnvelope(body, headers, opts9(world));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'DIRECTORY_LINK_REQUIRED');
});
test('envelope.sender.owner_id disagreeing with relay assertion → 403 SENDER_OWNER_ASSERTION_MISMATCH', async () => {
  const world = worldWithRecipient();
  const envelope = senderEnvelope(world.senderKeys.privateKey, { sender: { owner_id: 'usr_mismatch@primary.example', endpoint_id: `ep_codex@${ORIGIN}`, kind: 'agent' } });
  const { body, headers } = forwardPayload(world, {}, { envelope, senderOwnerId: 'usr_chris@primary.example' });
  const r = await acceptFederatedEnvelope(body, headers, opts9(world));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'SENDER_OWNER_ASSERTION_MISMATCH');
});
test('unknown recipient → 400 RECIPIENT_NOT_FOUND', async () => {
  const world = worldWithRecipient();
  const envelope = senderEnvelope(world.senderKeys.privateKey, { recipient: { owner_id: 'usr_chris@primary.example', endpoint_id: `ep_ghost@${RELAY}`, kind: 'agent' } });
  const { body, headers } = forwardPayload(world, {}, { envelope });
  const r = await acceptFederatedEnvelope(body, headers, opts9(world));
  assert.equal(r.status, 400); assert.equal(r.body.code, 'RECIPIENT_NOT_FOUND');
});
test('expired envelope → 422 MESSAGE_EXPIRED', async () => {
  const world = worldWithRecipient();
  const envelope = senderEnvelope(world.senderKeys.privateKey, { created_at: '2026-08-29T12:00:00.000Z', expires_at: '2026-08-29T12:10:00.000Z' });
  const { body, headers } = forwardPayload(world, {}, { envelope });
  const r = await acceptFederatedEnvelope(body, headers, { ...opts9(world), now: new Date('2026-08-30T12:00:30.000Z') });
  assert.equal(r.body.code, 'MESSAGE_EXPIRED');
});
test('re-POST of an accepted (sender.endpoint_id, idempotency_key) → 202 duplicate:true, no second delivery', async () => {
  const world = worldWithRecipient();
  const { body, headers } = forwardPayload(world);
  await acceptFederatedEnvelope(body, headers, opts9(world));
  const r2 = await acceptFederatedEnvelope(body, headers, opts9(world));
  assert.equal(r2.status, 202); assert.equal(r2.body.duplicate, true);
  assert.equal((await world.repo.listInbox(`ep_claude@${RELAY}`, '')).length, 1);
});
test('replay: same message_id under a new idempotency_key → 409 REPLAY_DETECTED', async () => {
  const world = worldWithRecipient();
  const { body, headers } = forwardPayload(world);
  await acceptFederatedEnvelope(body, headers, opts9(world));
  const envelope2 = senderEnvelope(world.senderKeys.privateKey, { idempotency_key: 'idem_2' });
  const p2 = forwardPayload(world, {}, { envelope: envelope2 });
  const r = await acceptFederatedEnvelope(p2.body, p2.headers, opts9(world));
  assert.equal(r.status, 409); assert.equal(r.body.code, 'REPLAY_DETECTED');
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs`
Expected: FAIL — the stub returns `ACCEPTED_STUB`, no delivery, no audit.

- [x] **Step 3: Confirm `memory-repository.lookupRecipientEndpoint` returns `owner_id`**

Read `sigil/cli/memory-repository.mjs` line ~69. It must return an object including `owner_id` (from the registry Map entry). If it returns only `{ status }` or the raw registry value without `owner_id`, adjust it to `return registry.get(endpointId) ?? null;` where registry entries already carry `owner_id`. Add a matching guarantee to `PostgresRepository.lookupRecipientEndpoint` (it should `SELECT endpoint_id, owner_id, status`).

- [x] **Step 4: Implement checks 6-10**

Replace the stub `return` at the end of `acceptFederatedEnvelope` with the transactional body. Add imports at the top: `import { validateEnvelope, signedBytes, reject } from './validate-envelope.mjs';` (extend the existing import) and `import { resolveRateLimits, DEFAULT_INBOX_DEPTH_LIMIT } from './relay-config.mjs';`.

```js
  const { registered, relayDomain, now = new Date() } = options;

  const auditReject = async (status, code, message, details = {}) => {
    if (repository.recordAuditEvent) {
      await repository.recordAuditEvent({ eventType: 'federation.inbound_rejected', subjectId: envelope.message_id, endpointId: envelope.sender?.endpoint_id, outcome: 'rejected', reason: code, payload: { origin_domain: originDomain }, now }).catch(() => {});
    }
    return respond(status, code, message, options, details);
  };

  return repository.withTransaction(async (client) => {
    // 10 (first): idempotent-duplicate lookup, before any re-verification.
    const priorIdem = await repository.lookupIdempotency(envelope.sender.endpoint_id, envelope.idempotency_key, client);
    if (priorIdem) {
      return { status: 202, body: { request_id: options.request_id ?? null, code: 'ACCEPTED', message_id: priorIdem.message_id, duplicate: true } };
    }
    // 6 (replay): same message_id under a different idempotency_key.
    const priorMsg = await repository.lookupAcceptedMessageId(envelope.sender.endpoint_id, envelope.message_id, client);
    if (priorMsg && priorMsg.idempotency_key !== envelope.idempotency_key) {
      throw reject('REPLAY_DETECTED', 'message_id was already accepted under a different idempotency_key');
    }
    // 6 (trimmed validation): synthetic single-entry registry for the sender.
    const syntheticRegistered = new Map([[envelope.sender.endpoint_id, {
      endpoint_id: envelope.sender.endpoint_id, owner_id: envelope.sender.owner_id,
      key_id: envelope.signature.key_id, status: 'active',
      public_key: crypto.createPublicKey({ key: Buffer.from(senderKey.publicKey, 'base64url'), format: 'der', type: 'spki' }),
    }]]);
    const result = validateEnvelope(envelope, { now, registered: syntheticRegistered, idempotency: new Map(), relayDomain, skipSenderRegistration: true });
    // 6 (owner-assertion consistency): sender's own claim must agree.
    if (envelope.sender.owner_id !== senderOwnerId) {
      throw reject('SENDER_OWNER_ASSERTION_MISMATCH', 'envelope.sender.owner_id does not equal the relay-asserted sender_owner_id');
    }
    // 7: recipient exists and is active in the receiver's registry.
    const recipientId = envelope.recipient.endpoint_id;
    const recipient = (await repository.lookupRecipientEndpoint(recipientId, client)) ?? registered?.get(recipientId);
    if (!recipient || recipient.status !== 'active') {
      throw reject('RECIPIENT_NOT_FOUND', 'The recipient endpoint does not exist in this relay\'s registry.', { recipient_id: recipientId });
    }
    // 8: directory gate — same-owner exemption only.
    if (senderOwnerId !== recipient.owner_id) {
      throw reject('DIRECTORY_LINK_REQUIRED', 'No cross-owner directory link; federated first contact is out of scope', { sender_owner_id: senderOwnerId, recipient_endpoint_id: recipientId });
    }
    // 9: rate reservations (verified federated sender id) + federation_origin + inbox depth.
    const limits = resolveRateLimits(options.rateLimits);
    const windowStart = new Date(Math.floor((now instanceof Date ? now.getTime() : Date.parse(now)) / 60_000) * 60_000).toISOString();
    for (const [scopeKind, scopeId] of [
      ['endpoint', envelope.sender.endpoint_id],
      ['owner', senderOwnerId],
      ['conversation', envelope.conversation_id],
      ['federation_origin', originDomain],
    ]) {
      const reservation = await repository.reserveRateLimit(scopeKind, scopeId, windowStart, limits[scopeKind] ?? limits.endpoint, client);
      if (!reservation.allowed) throw reject('RATE_LIMITED', `${scopeKind} rate limit exceeded`, { scope_kind: scopeKind, scope_id: scopeId });
    }
    const depthLimit = options.inboxDepthLimit ?? DEFAULT_INBOX_DEPTH_LIMIT;
    if ((await repository.countOpenDeliveries(recipientId, client)) >= depthLimit) {
      throw reject('QUOTA_EXCEEDED', 'Recipient inbox depth limit reached', { recipient_endpoint_id: recipientId, limit: depthLimit });
    }
    // 10: persist + deliver through the existing local path, federation_hop = true.
    const persisted = await repository.persistAcceptedEnvelope({ envelope, ...result, canonical_bytes: signedBytes(envelope), action_hash: result.canonical_hash, federation_hop: true }, client);
    if (repository.recordAuditEvent) {
      await repository.recordAuditEvent({ eventType: 'federation.inbound_accepted', subjectId: persisted?.message_id ?? result.message_id, endpointId: recipientId, outcome: 'accepted', reason: null, payload: { origin_domain: originDomain, recipient_domain: relayDomain }, now });
    }
    if (options.onPersisted) await options.onPersisted({ envelope, persisted });
    return { status: 202, body: { request_id: options.request_id ?? null, code: 'ACCEPTED', message_id: persisted?.message_id ?? result.message_id, duplicate: persisted?.duplicate ?? false } };
  }).catch(async (error) => {
    const status = { REPLAY_DETECTED: 409, MESSAGE_EXPIRED: 422, RECIPIENT_NOT_FOUND: 400, DIRECTORY_LINK_REQUIRED: 403, SENDER_OWNER_ASSERTION_MISMATCH: 403, RATE_LIMITED: 429, QUOTA_EXCEEDED: 429, INVALID_ENVELOPE: 400, INVALID_SIGNATURE: 401, VERSION_UNSUPPORTED: 400, CAPABILITY_DENIED: 403 }[error.code] ?? 400;
    return auditReject(status, error.code ?? 'INVALID_FEDERATION_REQUEST', error.message, error.details ?? {});
  });
```

Also wrap the checks 2-5 early returns so they emit `federation.inbound_rejected` — simplest: after computing each `respond(...)` for codes `PEER_NOT_TRUSTED`, `RELAY_SIGNATURE_INVALID`, `SENDER_DOMAIN_FOREIGN`, `INVALID_SIGNATURE`, call `repository.recordAuditEvent({ eventType: 'federation.inbound_rejected', subjectId: envelope?.message_id ?? null, ... })` first. Check 1 has no reliable `message_id`, so it does not audit (mirrors `accept-envelope.mjs`'s deliberate exclusion of pre-signature `INVALID_ENVELOPE`).

- [x] **Step 5: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/accept-federated-envelope.test.mjs`
Expected: PASS (all Task 8 + Task 9 tests).

- [x] **Step 6: Run the memory-repository regression**

Run: `node --test sigil/cli/memory-repository.test.mjs sigil/cli/memory-repository.peer.test.mjs`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add sigil/relay/v1/accept-federated-envelope.mjs sigil/relay/v1/accept-federated-envelope.test.mjs sigil/cli/memory-repository.mjs sigil/relay/v1/postgres-repository.mjs
git commit -m "feat(relay): acceptFederatedEnvelope checks 6-10 (validate, same-owner exemption, deliver)"
```

---

## Task 10: HTTP route `POST /v1/federation/envelopes`

**Files:**
- Modify: `sigil/relay/v1/http-server.mjs` — add the route near the `/v1/envelopes` handler (after line 229); thread new `createRelayServer` options
- Test: `sigil/relay/v1/http-server.federation-inbound.test.mjs` (new)

**Interfaces:**
- Consumes: `acceptFederatedEnvelope` from `accept-federated-envelope.mjs`; `readBody`, `registry`, `repository`, `relayDomain`, `requestId`, `now`, `stream` already in scope in `createRelayServer`.
- Produces: `POST /v1/federation/envelopes` → reads raw body (413 cap via existing `readBody`), `JSON.parse` (→ `400 INVALID_FEDERATION_REQUEST` on parse failure), lowercases header keys, calls `acceptFederatedEnvelope(parsed, headers, { repository, registered: registry, relayDomain, request_id: requestId, now, onPersisted })`. `onPersisted` calls `stream.notify(recipient.endpoint_id, message_id)` (same as `/v1/envelopes`, no receipt to the federated sender). Writes `result.status` + `result.body`. The route is unauthenticated at the transport layer (trust is the relay signature) — it must sit **before** the `authenticateRequest` gate at line 151, next to `/v1/health`.

- [x] **Step 1: Write the failing test**

Create `sigil/relay/v1/http-server.federation-inbound.test.mjs`. Build a relay via the same helper `http-server.test.mjs` uses (import `createRelayServer`, start on port 0, use a memory repository seeded with a pinned origin peer and a local recipient). Reuse `buildForwardRequest` / `signForwardRequest` to craft a signed forward, `POST` it with `fetch`, assert `202` + `{ code: 'ACCEPTED' }`, and assert a second identical POST returns `202 duplicate:true`. Add a negative: unpinned origin → `403 PEER_NOT_TRUSTED`.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRelayServer } from './http-server.mjs';
import { createMemoryRepository } from '../../cli/memory-repository.mjs';
import { signedBytes } from './validate-envelope.mjs';
import { buildForwardRequest, signForwardRequest } from './federation-router.mjs';

// ... (world setup mirrors accept-federated-envelope.test.mjs worldWithRecipient) ...

test('POST /v1/federation/envelopes delivers a signed forward and is idempotent', async () => {
  // start server, POST forward, expect 202 ACCEPTED; POST again, expect 202 duplicate:true
});
test('POST /v1/federation/envelopes from an unpinned origin → 403 PEER_NOT_TRUSTED', async () => {});
```

(Fill in the world setup by copying the `worldWithRecipient` helper; the plan's Task 9 test file is the reference.)

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/http-server.federation-inbound.test.mjs`
Expected: FAIL — route returns 404 (no handler).

- [x] **Step 3: Implement the route**

In `sigil/relay/v1/http-server.mjs`, `createRelayServer({ ... })` — add `federationMode`, `federationIdentity`, `fetchImpl` to the destructured options (used by Tasks 11-12). Immediately after the `/v1/health` block (line 149), add:

```js
    if (request.method === 'POST' && parsedUrl.pathname === '/v1/federation/envelopes') {
      let raw;
      try { raw = await readBody(request); }
      catch (error) { response.writeHead(413, { 'content-type': 'application/json', 'x-sigil-request-id': requestId }); return response.end(JSON.stringify({ request_id: requestId, code: error.code, message: error.message, details: {} })); }
      let body;
      try { body = JSON.parse(raw); }
      catch { response.writeHead(400, { 'content-type': 'application/json', 'x-sigil-request-id': requestId }); return response.end(JSON.stringify({ request_id: requestId, code: 'INVALID_FEDERATION_REQUEST', message: 'Invalid JSON', details: {} })); }
      const headers = {};
      for (const [k, v] of Object.entries(request.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
      const result = await acceptFederatedEnvelope(body, headers, {
        repository, registered: registry, relayDomain, request_id: requestId, now,
        onPersisted: async ({ envelope: accepted, persisted }) => {
          if (!stream || persisted?.duplicate) return;
          if (accepted.recipient?.endpoint_id) stream.notify(accepted.recipient.endpoint_id, persisted.message_id);
        },
      });
      response.writeHead(result.status, { 'content-type': 'application/json', 'x-sigil-request-id': requestId });
      return response.end(result.body ? JSON.stringify(result.body) : '');
    }
```

Add `import { acceptFederatedEnvelope } from './accept-federated-envelope.mjs';` at the top.

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/http-server.federation-inbound.test.mjs`
Expected: PASS.

- [x] **Step 5: Run the http-server regression**

Run: `node --test sigil/relay/v1/http-server.test.mjs`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add sigil/relay/v1/http-server.mjs sigil/relay/v1/http-server.federation-inbound.test.mjs
git commit -m "feat(relay): add POST /v1/federation/envelopes route"
```

---

## Task 11: Origin sync-mode forwarding in `acceptWithRepository`

**Files:**
- Modify: `sigil/relay/v1/accept-envelope.mjs` — `acceptWithRepository` (line 53), `statusByCode` (line 11)
- Modify: `sigil/relay/v1/http-server.mjs` — pass `federationMode`, `federationIdentity`, `fetchImpl` into the `/v1/envelopes` `acceptEnvelopeAsync` call
- Test: `sigil/relay/v1/accept-envelope.federation-sync.test.mjs` (new)

**Interfaces:**
- Consumes: `decideRoute`, `buildForwardRequest`, `signForwardRequest`, `postForward` from `federation-router.mjs`.
- Produces: `acceptWithRepository` accepts new `options`: `federationMode` (`'sync'` | `'queue'` | undefined), `federationIdentity` (parsed identity object or undefined), `fetchImpl`. The `checkRecipientLocality(envelope, options.relayDomain)` call at line 75 becomes:

```js
    const route = await decideRoute(envelope, {
      relayDomain: options.relayDomain,
      federationMode: options.federationMode,
      getPeerByDomain: repository.getPeerByDomain ? (d) => repository.getPeerByDomain(d) : async () => null,
    });
    if (route.action === 'reject') throw reject(route.code, `${route.code}`, route.details ?? {});
    if (route.action === 'forward') {
      return forwardEnvelope(envelope, route, options, client);
    }
    // route.action === 'local' → fall through unchanged
```

`forwardEnvelope` (new module-level `async function` in `accept-envelope.mjs`), sync mode only in this task:

```js
async function forwardEnvelope(envelope, route, options, client) {
  const { repository } = options;
  const registered = options.registered ?? new Map();
  const senderEntry = registered.get(envelope.sender.endpoint_id) ?? (repository.lookupRecipientEndpoint ? await repository.lookupRecipientEndpoint(envelope.sender.endpoint_id, client) : null);
  const senderOwnerId = senderEntry?.owner_id;
  const senderPub = senderEntry?.public_key;
  if (!senderOwnerId || !senderPub) throw reject('FORWARD_MISCONFIGURED', 'Authenticated local sender has no registered owner or key');
  const senderKey = {
    kid: envelope.signature.key_id,
    alg: 'Ed25519',
    publicKey: (senderPub.export ? senderPub.export({ type: 'spki', format: 'der' }) : senderPub).toString('base64url'),
  };
  const { canonicalBytes } = buildForwardRequest(envelope, { originDomain: options.relayDomain, senderKey, senderOwnerId, now: options.now ?? new Date() });
  const signed = signForwardRequest(canonicalBytes, options.federationIdentity);

  if (options.federationMode === 'queue') {
    return enqueueForward(envelope, route, options, client, { senderKey, senderOwnerId }); // Task 14
  }

  // sync
  let outcome;
  try { outcome = await (options.postForwardImpl ?? postForward)(route.peer, canonicalBytes, signed, { fetchImpl: options.fetchImpl }); }
  catch (error) {
    if (error.code === 'FORWARD_TRANSPORT_FAILED') {
      await recordFederationAudit(repository, 'federation.forward_unavailable', envelope, { recipient_domain: route.recipientDomain }, options.now);
      return { status: 504, body: { request_id: options.request_id ?? null, code: 'FORWARD_UNAVAILABLE', message: 'Peer relay unreachable', details: { recipientDomain: route.recipientDomain } } };
    }
    throw error;
  }
  if (outcome.ok) {
    await recordFederationAudit(repository, 'federation.forwarded', envelope, { recipient_domain: route.recipientDomain }, options.now);
    return { status: 202, body: { request_id: options.request_id ?? null, code: 'ACCEPTED', forwarded: true, forwarded_to: route.recipientDomain } };
  }
  await recordFederationAudit(repository, 'federation.forward_rejected', envelope, { recipient_domain: route.recipientDomain, peer_code: outcome.peerCode ?? null }, options.now);
  return { status: 502, body: { request_id: options.request_id ?? null, code: 'FORWARD_REJECTED', message: 'Peer relay rejected the forward', details: { peerStatus: outcome.status, peerCode: outcome.peerCode ?? null } } };
}

function recordFederationAudit(repository, eventType, envelope, payload, now) {
  if (!repository.recordAuditEvent) return Promise.resolve();
  return repository.recordAuditEvent({ eventType, subjectId: envelope.message_id, endpointId: envelope.sender?.endpoint_id, outcome: eventType.endsWith('forwarded') ? 'forwarded' : 'rejected', reason: null, payload, now }).catch(() => {});
}
```

Add to `statusByCode`: `PEER_NOT_PINNED: 400, FEDERATION_HOP_EXCEEDED: 400, FORWARD_MISCONFIGURED: 500, FORWARD_REJECTED: 502, FORWARD_UNAVAILABLE: 504`.

**Note:** in `sync` mode the forward happens inside the accept transaction (`client` in scope) but writes nothing to local `envelopes`/`deliveries` — `forwardEnvelope` returns before `persistAcceptedEnvelope` is reached. The transaction commits with no rows written. That is acceptable (no-op transaction); do not restructure the accept path to avoid opening it.

> **Superseded by I1 (`8fdd1fb` + `7d14e4a` + `e8bf8b7` + `fabb4fe`).** The no-op-transaction shortcut above was reverted: under a slow or hung peer, holding a pool connection open across `postForward` for the whole 5s timeout exhausted the pool. `acceptWithRepository` now runs in two phases — `decideRoute`, the `reject` short-circuit, the sync-forward replay check, and the `sync`-mode `forward` all execute **before** `repository.withTransaction` opens (pool default connection, nothing written locally); Phase 2 opens the transaction only for `queue` enqueue and `local` accept. Phase 1 carries its own `try/catch` wrapping `decideRoute` so `RECIPIENT_NOT_LOCAL` / `MALFORMED_FEDERATED_ID` throws are mapped, not escaped. See the spec's "Resolved (I1 …)" block for the full contract; `sync` mode is now production-safe with respect to slow peers.

- [x] **Step 1: Write the failing test**

Create `sigil/relay/v1/accept-envelope.federation-sync.test.mjs`: seed a memory repo with a pinned peer for `b.example` and a local sender `ep_codex@a.example` (owner + key). Call `acceptEnvelopeAsync(envelope, { repository, registered, relayDomain: 'a.example', federationMode: 'sync', federationIdentity, now, request_id, postForwardImpl })` with an injected `postForwardImpl` returning `{ ok: true, status: 202 }` → assert `202` + `forwarded: true` + `forwarded_to: 'b.example'` and nothing in `repo._debugGetEnvelope`. Then `{ ok: false, status: 403, peerCode: 'DIRECTORY_LINK_REQUIRED' }` → `502 FORWARD_REJECTED`. Then a `postForwardImpl` that throws `FORWARD_TRANSPORT_FAILED` → `504 FORWARD_UNAVAILABLE`. Then a sender with no registered key → `500 FORWARD_MISCONFIGURED`.

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/relay/v1/accept-envelope.federation-sync.test.mjs`
Expected: FAIL — options ignored, foreign recipient still `RECIPIENT_NOT_LOCAL`.

- [x] **Step 3: Implement** per the interface block above. Add `import { decideRoute, buildForwardRequest, signForwardRequest, postForward } from './federation-router.mjs';` to `accept-envelope.mjs`.

- [x] **Step 4: Wire http-server** — in the `/v1/envelopes` handler (line 212), add `federationMode, federationIdentity, fetchImpl` to the `acceptEnvelopeAsync` options object (values from `createRelayServer`'s destructured options).

- [x] **Step 5: Run the test to verify it passes**

Run: `node --test sigil/relay/v1/accept-envelope.federation-sync.test.mjs`
Expected: PASS.

- [x] **Step 6: Regression**

Run: `node --test sigil/relay/v1/accept-envelope.test.mjs sigil/relay/v1/http-server.test.mjs sigil/cli/relay-up-domain.test.mjs`
Expected: PASS — with `federationMode` undefined, `decideRoute` delegates to `checkRecipientLocality` and every existing path is byte-identical.

- [x] **Step 7: Commit**

```bash
git add sigil/relay/v1/accept-envelope.mjs sigil/relay/v1/http-server.mjs sigil/relay/v1/accept-envelope.federation-sync.test.mjs
git commit -m "feat(relay): sync-mode foreign-envelope forwarding via decideRoute"
```

---

## Task 12: `sigil relay up --federation-mode sync --federation-identity`

**Files:**
- Modify: `sigil/cli/sigil.mjs` — `cmdRelayUp` (line 133), usage text (line ~45)
- Test: `sigil/cli/relay-up-federation.test.mjs` (new)

**Interfaces:**
- Consumes: `loadIdentity` from `sigil/cli/identity.mjs`.
- Produces: `sigil relay up` accepts `--federation-mode <sync|queue>` and `--federation-identity <path>`. Validation, before the listener binds (mirror how `--domain` is validated at line 147):
  - invalid `--federation-mode` value → abort with `sigil relay up: --federation-mode must be "sync" or "queue"`.
  - `--federation-mode` set without `--domain` → abort `--federation-mode requires --domain`.
  - `--federation-mode` set without `--federation-identity` → abort `--federation-mode requires --federation-identity <path>`.
  - `--federation-identity` file missing/unreadable/not JSON → abort (let `loadIdentity`'s error propagate).
  - `queue` without `--database-url` / `SIGIL_DATABASE_URL` → abort `--federation-mode queue requires --database-url`.
  - `queue` on an in-memory relay (no `databaseUrl`) → same abort (covered by the line above).
  Then pass `federationMode` and `federationIdentity: loadIdentity(path)` into `createRelayServer({ ..., federationMode, federationIdentity })`. (Reaper start for `queue` is Task 16.)

- [x] **Step 1: Write the failing test**

Create `sigil/cli/relay-up-federation.test.mjs`. Shell out with a short timeout and assert the process exits non-zero with the expected message on stderr before binding. Pattern:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const sigilCli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sigil.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-relayfed-test-'));

function runRelayUp(args, cwd) {
  return execFileSync(process.execPath, [sigilCli, 'relay', 'up', ...args], { cwd, encoding: 'utf8', timeout: 5000 });
}

test('--federation-mode bogus aborts before binding', () => {
  const cwd = tmp();
  try {
    execFileSync(process.execPath, [sigilCli, 'init', 'a', '--domain', 'a.example'], { cwd });
    assert.throws(() => runRelayUp(['--registry', 'registry.json', '--domain', 'a.example', '--federation-mode', 'bogus', '--federation-identity', '.sigil/a.identity.json'], cwd),
      (e) => /--federation-mode must be "sync" or "queue"/.test(e.stderr ?? e.message));
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('--federation-mode queue without --database-url aborts', () => { /* ... expect /--federation-mode queue requires --database-url/ ... */ });
test('--federation-mode sync without --federation-identity aborts', () => { /* ... */ });
test('--federation-mode sync without --domain aborts', () => { /* ... */ });
test('--federation-identity pointing at a missing file aborts', () => { /* ... */ });
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test sigil/cli/relay-up-federation.test.mjs`
Expected: FAIL — flags unknown to `parseArgs`, or ignored (relay tries to bind and the test times out).

- [x] **Step 3: Implement**

In `cmdRelayUp`'s `parseArgs` options add `'federation-mode': { type: 'string' }, 'federation-identity': { type: 'string' }`. After the `relayDomain` block (line ~145-151) add:

```js
  const federationMode = opt(args, ['federation-mode']);
  let federationIdentity;
  if (federationMode !== undefined) {
    if (!['sync', 'queue'].includes(federationMode)) throw new Error('sigil relay up: --federation-mode must be "sync" or "queue"');
    if (relayDomain === undefined) throw new Error('sigil relay up: --federation-mode requires --domain');
    const identityPath = opt(args, ['federation-identity']);
    if (!identityPath) throw new Error('sigil relay up: --federation-mode requires --federation-identity <path>');
    federationIdentity = loadIdentity(identityPath); // throws on missing / non-JSON
    if (federationMode === 'queue' && !databaseUrl) throw new Error('sigil relay up: --federation-mode queue requires --database-url (or SIGIL_DATABASE_URL)');
  }
```

Add `federationMode, federationIdentity` to the `createRelayServer({ ... })` call (line ~212). Add `loadIdentity` to the `sigil/cli/identity.mjs` import at the top of `sigil.mjs` if not already imported. Update the `relay up` usage text.

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test sigil/cli/relay-up-federation.test.mjs`
Expected: PASS.

- [x] **Step 5: Regression**

Run: `node --test sigil/cli/relay-up-domain.test.mjs sigil/cli/sigil-relay-postgres-startup.integration.test.mjs`
Expected: PASS (the Postgres startup test needs a live DB; skip locally if unavailable, it runs in CI).

- [x] **Step 6: Commit**

```bash
git add sigil/cli/sigil.mjs sigil/cli/relay-up-federation.test.mjs
git commit -m "feat(cli): sigil relay up --federation-mode sync --federation-identity"
```

---

## Task 13: `federation_outbox` repository methods (Postgres)

**Files:**
- Modify: `sigil/relay/v1/postgres-repository.mjs` — add methods + `rowToFederationOutboxRecord`
- Test: `sigil/relay/v1/postgres-repository.federation-outbox.test.mjs` (new; live-DB, mirrors `postgres-repository.peer.test.mjs` shape)

**Interfaces:**
- Consumes: `this.pool`, `this.withTransaction`, `gen_random_uuid()`.
- Produces (all on `PostgresRepository` only; `createMemoryRepository` gets none — `queue` mode is rejected before it can call these):
  - `enqueueFederationForward(row, client)` → `{ row, inserted }`. `row` in: `{ messageId, idempotencyKey, recipientDomain, originDomain, envelope, senderKey, senderOwnerId, now }`. `INSERT ... ON CONFLICT (message_id, idempotency_key) DO NOTHING RETURNING *`. On conflict (0 rows) → re-`SELECT` the existing row and return `{ row: existing, inserted: false }`.
  - `claimDueFederationForwards(now, limit, leaseSeconds, client)` → `Array<record>`. One `UPDATE ... SET state='processing', claimed_at=now(), claim_token=gen_random_uuid(), attempt_count = attempt_count + CASE WHEN state='processing' THEN 1 ELSE 0 END WHERE id IN (SELECT id FROM federation_outbox WHERE (state='pending' AND next_attempt_at <= $now) OR (state='processing' AND claimed_at < $now - make_interval(secs => $leaseSeconds)) ORDER BY next_attempt_at LIMIT $limit FOR UPDATE SKIP LOCKED) RETURNING *`.
  - `finalizeFederationForward(id, claimToken, state, { attemptCount, nextAttemptAt, reasonCode }, client)` → `{ updated: boolean }`. `UPDATE ... SET state=$state, claim_token=NULL, claimed_at=NULL, attempt_count=COALESCE($attemptCount, attempt_count), next_attempt_at=COALESCE($nextAttemptAt, next_attempt_at), last_reason_code=$reasonCode, updated_at=now() WHERE id=$id AND claim_token=$claimToken`. `updated` = `rowCount > 0` (false = lease stolen; caller discards).
  - `listFederationOutbox({ states } = {})` → `{ counts: { pending, processing, forwarded, forward_rejected, dead_letter }, rows: Array<record without envelope/sender_key> }`.
  - `getFederationOutboxRow(id)` → `record | null` (full row).
  - `retryFederationForward(id, now, client)` → `{ retried: boolean, reason? }`. Only a `forward_rejected` or `dead_letter` row: `UPDATE ... SET state='pending', attempt_count=0, claim_token=NULL, claimed_at=NULL, next_attempt_at=$now, last_reason_code=NULL WHERE id=$id AND state IN ('forward_rejected','dead_letter')`. If the row's envelope `expires_at` <= `now` → do not update, return `{ retried: false, reason: 'MESSAGE_EXPIRED' }`.
  - `rowToFederationOutboxRecord(row)` → camelCase `{ id, messageId, idempotencyKey, recipientDomain, originDomain, envelope, senderKey, senderOwnerId, state, attemptCount, nextAttemptAt, claimedAt, claimToken, lastReasonCode, createdAt, updatedAt }`.

- [x] **Step 1: Write the failing test** — `sigil/relay/v1/postgres-repository.federation-outbox.test.mjs`, guarded by `SIGIL_DATABASE_URL` (skip when unset, mirroring `postgres-repository.peer.test.mjs`). Cases: enqueue inserts one row (`inserted: true`); re-enqueue same `(message_id, idempotency_key)` → `inserted: false` + existing row; `claimDueFederationForwards` moves `pending`→`processing` and sets `claim_token`; a `processing` row past the lease is re-claimed with `attempt_count` incremented; `finalizeFederationForward` with the right token updates, with a stale token is a no-op (`updated: false`); `retryFederationForward` moves `dead_letter`→`pending`; retry of an expired-envelope row → `{ retried: false, reason: 'MESSAGE_EXPIRED' }`; **two concurrent `claimDueFederationForwards` callers never return the same row** (run two `withTransaction` claims in `Promise.all`, assert disjoint id sets).

- [x] **Step 2: Run the test to verify it fails**

Run: `SIGIL_DATABASE_URL=$SIGIL_TEST_DATABASE_URL node --test sigil/relay/v1/postgres-repository.federation-outbox.test.mjs`
Expected: FAIL — methods undefined.

- [x] **Step 3: Implement** the six methods + helper on `PostgresRepository`, following the existing method style (e.g. `claimDelivery` at line ~423 for the claim/lease pattern, `upsertPeer` for `ON CONFLICT ... RETURNING` + `rowTo…Record`).

- [x] **Step 4: Run the test to verify it passes**

Run: `SIGIL_DATABASE_URL=$SIGIL_TEST_DATABASE_URL node --test sigil/relay/v1/postgres-repository.federation-outbox.test.mjs`
Expected: PASS.

- [x] **Step 5: Run `npm test`** (invokes the live-DB job in CI; locally runs what it can). Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add sigil/relay/v1/postgres-repository.mjs sigil/relay/v1/postgres-repository.federation-outbox.test.mjs
git commit -m "feat(relay): federation_outbox repository methods (enqueue/claim/finalize/list/retry)"
```

---

## Task 14: Queue-mode enqueue in `acceptWithRepository`

**Files:**
- Modify: `sigil/relay/v1/accept-envelope.mjs` — `forwardEnvelope` / new `enqueueForward`
- Test: `sigil/relay/v1/accept-envelope.federation-queue.test.mjs` (new; live-DB guarded by `SIGIL_DATABASE_URL`)

**Interfaces:**
- Consumes: `repository.enqueueFederationForward`.
- Produces: when `options.federationMode === 'queue'`, `forwardEnvelope` calls `enqueueForward`:

```js
async function enqueueForward(envelope, route, options, client, { senderKey, senderOwnerId }) {
  const { repository } = options;
  const { row, inserted } = await repository.enqueueFederationForward({
    messageId: envelope.message_id, idempotencyKey: envelope.idempotency_key,
    recipientDomain: route.recipientDomain, originDomain: options.relayDomain,
    envelope, senderKey, senderOwnerId, now: options.now ?? new Date(),
  }, client);
  await recordFederationAudit(repository, 'federation.queued', envelope, { recipient_domain: route.recipientDomain }, options.now);
  return { status: 202, body: { request_id: options.request_id ?? null, code: 'ACCEPTED', queued: true, duplicate: !inserted } };
}
```

The unique constraint makes a client retry land as `inserted: false` → `queued: true, duplicate: true`, no second row, no second forward (the spec's "any state, including forwarded/terminal" case is covered because the unique index has no state predicate).

- [x] **Step 1: Write the failing test** — `accept-envelope.federation-queue.test.mjs` (skip without `SIGIL_DATABASE_URL`): a `PostgresRepository`-backed accept with `federationMode: 'queue'`, pinned peer, local sender → `202 queued:true` and exactly one `federation_outbox` row (`state='pending'`); a second identical accept → `202 queued:true, duplicate:true` and still one row. An in-memory repo + `federationMode: 'queue'` is not exercised here (Task 16 asserts startup abort).

- [x] **Step 2: Run to verify it fails.** `enqueueForward` throws (`repository.enqueueFederationForward` undefined on the path, or the branch not wired).

- [x] **Step 3: Implement** `enqueueForward` and the `if (options.federationMode === 'queue') return enqueueForward(...)` branch in `forwardEnvelope` (already stubbed in Task 11's code).

- [x] **Step 4: Run to verify it passes.**

- [x] **Step 5: Regression** — `node --test sigil/relay/v1/accept-envelope.federation-sync.test.mjs sigil/relay/v1/accept-envelope.test.mjs`. Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add sigil/relay/v1/accept-envelope.mjs sigil/relay/v1/accept-envelope.federation-queue.test.mjs
git commit -m "feat(relay): queue-mode federation_outbox enqueue on accept"
```

---

## Task 15: Federation reaper pass + driver

**Files:**
- Create: `sigil/relay/v1/federation-reaper.mjs`
- Test: `sigil/relay/v1/federation-reaper.test.mjs` (new)

**Interfaces:**
- Consumes: `buildForwardRequest`, `signForwardRequest`, `postForward` from `federation-router.mjs`; `repository.claimDueFederationForwards`, `repository.finalizeFederationForward`, `repository.recordAuditEvent`, `repository.withTransaction`.
- Produces:
  `runFederationReaperPass({ repository, identity, originDomain, now = new Date(), fetchImpl, postForwardImpl, limit = 500, leaseSeconds = 300 })` → `Promise<{ claimed, forwarded, rejected, failed, deadLettered }>`.
  - Step 1: `const rows = await repository.withTransaction((client) => repository.claimDueFederationForwards(now, limit, leaseSeconds, client));` — claim + commit.
  - Step 2, per row: `buildForwardRequest(row.envelope, { originDomain, senderKey: row.senderKey, senderOwnerId: row.senderOwnerId, now })`; if `Date.parse(row.envelope.expires_at) <= now.getTime()` → finalize `dead_letter` with `reasonCode: 'MESSAGE_EXPIRED'`, audit `federation.dead_letter`, continue. Else `signForwardRequest` + `(postForwardImpl ?? postForward)(peerFromRow, canonicalBytes, signed, { fetchImpl })`. `peerFromRow` = `{ relayUrl: <resolved> }` — the reaper needs the peer URL; store it by calling `repository.getPeerByDomain(row.recipientDomain)` (unpinned now → treat as transport failure path). 
  - Step 3: ownership-guarded `repository.finalizeFederationForward(row.id, row.claimToken, state, { attemptCount, nextAttemptAt, reasonCode }, client)` inside a `withTransaction`; if `{ updated: false }` → discard silently.
    - `ok:true` → `state='forwarded'`, audit `federation.forwarded`.
    - `ok:false` (4xx) → `state='forward_rejected'`, `reasonCode = outcome.peerCode ?? null`, audit `federation.forward_rejected`.
    - `FORWARD_TRANSPORT_FAILED` (throw) → `attemptCount = row.attemptCount` (already incremented by the claim's reclaim rule? no — increment here): `nextAttemptCount = row.attemptCount + 1`; if `nextAttemptCount >= 4` (`MAX_ATTEMPTS = 4`, revised in final-review fix I4 so all three backoff tiers are walked) → `state='dead_letter'`, audit `federation.dead_letter`; else `state='pending'`, `nextAttemptAt = now + [60000, 300000, 1800000][nextAttemptCount - 1]` ms, audit `federation.forward_unavailable` with `attempt_count`.
  `startFederationReaper({ repository, identity, originDomain, intervalMs = 60_000, fetchImpl })` → the `setInterval` handle (`.unref()`'d), mirroring `startOidcIssuerAllowlistPolling` in `sigil.mjs:121`. Each tick calls `runFederationReaperPass(...)` and `console.error`s on a thrown pass (keeps ticking).

- [x] **Step 1: Write the failing test** — `federation-reaper.test.mjs` with an in-memory fake repository object exposing `withTransaction(fn) { return fn(null); }`, `claimDueFederationForwards`, `finalizeFederationForward`, `recordAuditEvent`, `getPeerByDomain`, plus a rows array. Cases with injected `now` and `postForwardImpl`:
  - one due row, `postForwardImpl` → `{ ok: true }` → row `forwarded`, `federation.forwarded` audit.
  - `postForwardImpl` → `{ ok: false, status: 403, peerCode: 'DIRECTORY_LINK_REQUIRED' }` → `forward_rejected` (terminal), audit carries `peerCode`.
  - `postForwardImpl` throwing `FORWARD_TRANSPORT_FAILED` three times across three passes → `pending` with `next_attempt_at` at +60s, +300s, then `dead_letter` + `federation.dead_letter`.
  - a row whose `envelope.expires_at` is before `now` → `dead_letter` reason `MESSAGE_EXPIRED`, no forward attempted.
  - `finalizeFederationForward` returning `{ updated: false }` (stale token) → pass does not throw, no audit for that row.

- [x] **Step 2: Run to verify it fails.** Module missing.

- [x] **Step 3: Implement** `runFederationReaperPass` + `startFederationReaper`.

- [x] **Step 4: Run to verify it passes.**

- [x] **Step 5: Commit**

```bash
git add sigil/relay/v1/federation-reaper.mjs sigil/relay/v1/federation-reaper.test.mjs
git commit -m "feat(relay): federation reaper pass + interval driver"
```

---

## Task 16: Wire the reaper into `sigil relay up` (queue mode)

**Files:**
- Modify: `sigil/cli/sigil.mjs` — `cmdRelayUp`, add `startFederationReaper` start for `queue` mode; abort in-memory + `queue`
- Test: `sigil/cli/relay-up-federation.test.mjs` (extend)

**Interfaces:**
- Consumes: `startFederationReaper` from `sigil/relay/v1/federation-reaper.mjs`.
- Produces: after the server binds, when `federationMode === 'queue'` and `databaseUrl` is set:

```js
  let federationReaperTimer;
  if (federationMode === 'queue') {
    const { startFederationReaper } = await import('../relay/v1/federation-reaper.mjs');
    federationReaperTimer = startFederationReaper({ repository, identity: federationIdentity, originDomain: relayDomain });
    console.log('Federation outbox reaper running (60s interval).');
  }
```

The Task 12 validation already aborts `queue` without `--database-url`; an in-memory relay never sets `databaseUrl`, so `queue` + in-memory hits that same abort — add a test asserting the message names the in-memory case (adjust the Task 12 error string to `--federation-mode queue requires --database-url (or SIGIL_DATABASE_URL); in-memory relays have no durable outbox`).

- [x] **Step 1: Write the failing test** — extend `relay-up-federation.test.mjs`: `--federation-mode queue` on a relay with no `--database-url` aborts with a message mentioning "in-memory relays have no durable outbox". (A positive "reaper actually starts" assertion needs a live DB + process management; leave that to the CI Postgres startup integration test — add a `TODO` note there.)

- [x] **Step 2: Run to verify it fails.**

- [x] **Step 3: Implement** the reaper start + refine the abort message.

- [x] **Step 4: Run to verify it passes.**

- [x] **Step 5: Regression** — `node --test sigil/cli/relay-up-federation.test.mjs sigil/cli/relay-up-domain.test.mjs`. Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add sigil/cli/sigil.mjs sigil/cli/relay-up-federation.test.mjs
git commit -m "feat(cli): start federation outbox reaper for queue-mode relays"
```

---

## Task 17: `sigil federation outbox list|show|retry`

**Files:**
- Modify: `sigil/cli/sigil.mjs` — new `cmdFederation`, dispatch (`command === 'federation'` near line 729), usage text
- Test: `sigil/cli/sigil-federation-outbox.test.mjs` (new; live-DB guarded)

**Interfaces:**
- Consumes: `withRepository(args, requireMsg, fn, { migrate: true })` (existing helper, `sigil.mjs:414`); `repository.listFederationOutbox`, `repository.getFederationOutboxRow`, `repository.retryFederationForward`.
- Produces:
  - `sigil federation outbox list [--database-url url]` → prints `pending` / `forward_rejected` / `dead_letter` counts, then a table of rows (`id`, `state`, `recipient_domain`, `attempt_count`, `next_attempt_at`, `last_reason_code`) — **no envelope bodies**.
  - `sigil federation outbox show <id> [--database-url url]` → one row's metadata + (if available) transition history from audit events for that `message_id`; no envelope body.
  - `sigil federation outbox retry <id> [--database-url url]` → calls `retryFederationForward(id, new Date())`; prints `Re-queued <id>` or, on `{ retried: false, reason: 'MESSAGE_EXPIRED' }`, `Cannot retry <id>: the stored envelope has expired — have the sender resend.` and exits non-zero.
  - All three require `--database-url` / `SIGIL_DATABASE_URL` (via `withRepository(args, 'sigil federation outbox requires --database-url ...', ...)`); on a `sync`-mode / in-memory relay the table is simply empty.

- [x] **Step 1: Write the failing test** — `sigil-federation-outbox.test.mjs` (skip without `SIGIL_DATABASE_URL`): seed a `federation_outbox` row via `applyMigrations` + a direct `INSERT`, then run `sigil federation outbox list` and assert the output has the counts line and the row id but not the word `"text"` (no body). `retry` on a `dead_letter` row prints `Re-queued`. `retry` on an expired row exits non-zero with the resend message.

- [x] **Step 2: Run to verify it fails.** `Unknown command: federation`.

- [x] **Step 3: Implement** `cmdFederation(argv)` — parse `argv[0] === 'outbox'`, then `argv[1]` in `list|show|retry`, else print usage. Dispatch from the `switch`/`if` chain at `sigil.mjs:729` (`if (command === 'federation') await cmdFederation(process.argv.slice(3));`). Add the usage lines.

- [x] **Step 4: Run to verify it passes.**

- [x] **Step 5: Commit**

```bash
git add sigil/cli/sigil.mjs sigil/cli/sigil-federation-outbox.test.mjs
git commit -m "feat(cli): sigil federation outbox list|show|retry"
```

---

## Task 18: `sigil route test`

**Files:**
- Modify: `sigil/cli/sigil.mjs` — new `cmdRoute`, dispatch, usage text
- Test: `sigil/cli/sigil-route-test.test.mjs` (new)

**Interfaces:**
- Consumes: `loadIdentity`; `parseFederatedId` from `federated-id.mjs`; `withRepository` (for the peer directory lookup); the `/v1/health` probe pattern from `sigil/cli/doctor.mjs:47-70` (`fetch(new URL('/v1/health', relayUrl), { signal: AbortSignal.timeout(...) })`).
- Produces:
  `sigil route test <recipient_federated_id> --identity <path> --relay-url <url> [--database-url url]` — read-only, **sends no envelope**. Steps and output:
  1. `parseFederatedId(recipient)` → print `Recipient: <local>@<domain>` or exit non-zero on `MALFORMED_FEDERATED_ID`.
  2. Resolve `<domain>` against the local peer directory (`repository.getPeerByDomain`). Print `Pinned: yes` + `Peer relay URL: <relayUrl>` or `Pinned: no` (and stop, exit non-zero).
  3. Reachability: `GET {peer.relayUrl}/v1/health` with a 5s `AbortSignal.timeout`; print `Reachable: yes (NNms)` or `Reachable: no (<reason>)`.
  4. **Advisory** same-owner line: `loadIdentity(--identity).owner_id` vs the recipient's `owner_id` **if the recipient endpoint is resolvable in the local registry** (`--registry` default). Print `Same-owner exemption: would apply (advisory)` / `would NOT apply (advisory) — owner ids differ` / `not determinable locally`. Always followed by `(advisory only — the receiving relay re-checks against its own registry)`.

- [x] **Step 1: Write the failing test** — `sigil-route-test.test.mjs`: with a memory-only setup this is limited; assert (a) a malformed recipient exits non-zero, (b) with an unpinned domain the output says `Pinned: no`, (c) with a pinned peer (seed via `sigil peer add` against a `--database-url` test DB, or skip when unset) the output includes `Peer relay URL:` and a `Reachable:` line (point `--relay-url` / peer URL at a throwaway `http.createServer` that answers `/v1/health` with 200). No envelope is ever POSTed — assert the stub server received only `GET /v1/health`.

- [x] **Step 2: Run to verify it fails.** `Unknown command: route`.

- [x] **Step 3: Implement** `cmdRoute(argv)` (`argv[0] === 'test'`), dispatch (`if (command === 'route') await cmdRoute(process.argv.slice(3));`), usage text.

- [x] **Step 4: Run to verify it passes.**

- [x] **Step 5: Commit**

```bash
git add sigil/cli/sigil.mjs sigil/cli/sigil-route-test.test.mjs
git commit -m "feat(cli): sigil route test read-only federation diagnostic"
```

---

## Task 19: Regression sweep, docs, plan close-out

**Files:**
- Create: `sigil/relay/v1/federation-regression.test.mjs`
- Modify: `STATUS.md`, `CHANGELOG.md`
- Modify: `C:\dev\docs\superpowers\plans\2026-08-30-sigil-inter-relay-routing.md` — check every box

**Interfaces:** none new.

- [x] **Step 1: Write the regression tests**

Create `sigil/relay/v1/federation-regression.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptEnvelopeAsync } from './accept-envelope.mjs';
import { createMemoryRepository } from '../../cli/memory-repository.mjs';
// (reuse a signed-envelope + registered-sender helper from an existing test file
//  or inline one as in Task 3.)

test('a --domain relay with NO --federation-mode still rejects a foreign recipient RECIPIENT_NOT_LOCAL', async () => {
  // acceptEnvelopeAsync(envelope-to-b.example, { repository, registered, relayDomain: 'a.example' /* no federationMode */ })
  // → status 400, code RECIPIENT_NOT_LOCAL
});
test('a --domain relay with NO --federation-mode still accepts a matching-domain recipient', async () => { /* ... 202 ... */ });
test('a relay with NO --domain runs no federation logic (bare ids still work)', async () => { /* ... */ });
test('two federated recipients differing only in local-part case stay distinct through the federated-inbound registry lookup', async () => {
  // ep_Claude@b.example vs ep_claude@b.example resolve to different registry entries
});
```

- [x] **Step 2: Run the regression tests**

Run: `node --test sigil/relay/v1/federation-regression.test.mjs`
Expected: PASS.

- [x] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS (dep audit + JCS audit + all `node --test` files, including the live-DB job in CI).

- [x] **Step 4: Update `CHANGELOG.md`** — add an entry under the working version:

> **Federation sub-project #3 — inter-relay routing.** Opt-in `sigil relay up --federation-mode sync|queue --federation-identity <path>` forwards foreign-domain envelopes to TOFU-pinned peer relays over `POST /v1/federation/envelopes`, signed with the origin relay's `.well-known/sigil` key. `queue` mode persists to a new `federation_outbox` table drained by a 60s reaper (300s lease, `FOR UPDATE SKIP LOCKED` + `claim_token` guard). Receiver enforces mutual pinning, canonicalize-after-parse relay-signature verification, end-to-end sender-key verification, and a relay-signed `sender_owner_id` same-owner exemption; every accepted federated envelope is stored `federation_hop = true` (one hop, structural). New: `sigil init --federation-owner`, `sigil route test`, `sigil federation outbox list|show|retry`. Migration `017_federation_outbox.sql`.

- [x] **Step 5: Update `STATUS.md`** — set the active goal to "Federation #3 (inter-relay routing) — shipped on `feat/federation-inter-relay-routing`", list the 19 tasks done, note tests green, next action "open PR; then sub-project #4 (cross-federation directory/presence)".

- [x] **Step 6: Check every box in this plan file**, then commit.

```bash
git add sigil/relay/v1/federation-regression.test.mjs CHANGELOG.md STATUS.md
git commit -m "test(relay): federation routing regression sweep + changelog/status"
```

- [x] **Step 7: Open the PR**

```bash
git push -u origin feat/federation-inter-relay-routing
gh pr create --fill --base main
```

---

## Execution — Batch 1 (Tasks 1–3 only)

This plan is executed with `superpowers:subagent-driven-development`, **one batch at a time to conserve tokens**. Batch 1 is Tasks 1, 2, and 3 only. Stop after Task 3's completion line lands in the ledger; do not dispatch Task 4. A later session resumes at Task 4 from the same ledger.

- **Code repo:** `C:\dev\sigil-repo`. Preflight before any work: `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`.
- **Worktree/branch:** isolated worktree off `sigil-repo` `main`, branch `feat/federation-inter-relay-routing`. Not `feat/relay-well-known-generate`.
- **Ledger:** `<sigil-repo-worktree>/.superpowers/sdd/2026-08-30-sigil-inter-relay-routing/progress.md`.
- **Models:** Task 1 (transcription + CLI tests, 1 file + doc) → cheap tier. Task 2 (migration + 2 repo files + memory/pg parity) → standard tier. Task 3 (1 file, complete code in brief) → cheap tier. Reviewers → mid tier.
- **No batch-end final whole-branch review** — that runs only after the last batch (Task 19). Batch 1 ends at the Task 3 completion line.
- Batches after this one: Batch 2 = Tasks 4–7 (`federation-router.mjs`), Batch 3 = Tasks 8–10 (receiver), Batch 4 = Tasks 11–12 (sync origin), Batch 5 = Tasks 13–16 (queue + reaper), Batch 6 = Tasks 17–19 (CLI + close-out).

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| Prerequisite: #1 amendment (`sigil init --federation-owner`) | 1 |
| `federation_hop` column; `decideRoute` treats truthy as hard stop | 2, 4 |
| `validateEnvelope` `skipSenderRegistration` | 3 |
| `federation-router.decideRoute` (all branches incl. `FEDERATION_HOP_EXCEEDED`, `PEER_NOT_PINNED`) | 4 |
| `buildForwardRequest` (canonicalBytes = wire body = signing input) | 5 |
| `signForwardRequest` | 5 |
| `postForward` (2xx/4xx/5xx/timeout, 4 KiB cap, `^[A-Z][A-Z0-9_]{0,63}$`, `redirect: 'error'`, target always `peer.relayUrl`) | 6 |
| Wire signature verify: canonicalize-after-parse, tamper/kid/kid-reuse fail closed | 7, 10 |
| `acceptFederatedEnvelope` checks 1–5 | 8 |
| `acceptFederatedEnvelope` checks 6–10 (trimmed validate, owner-assertion consistency, recipient exists, same-owner exemption, rate limits incl. `federation_origin`, persist `federation_hop=true`, idempotent duplicate) | 9 |
| `POST /v1/federation/envelopes` route | 10 |
| Origin `sync` mode (202 `forwarded`, 502 `FORWARD_REJECTED`, 504 `FORWARD_UNAVAILABLE`, 500 `FORWARD_MISCONFIGURED`, nothing written locally) | 11 |
| CLI `--federation-mode` / `--federation-identity` validation | 12 |
| `federation_outbox` table + indexes + repo methods (claim/lease/finalize/list/retry, 2-concurrent-claimers) | 2, 13 |
| Queue-mode enqueue (unique-constraint idempotent duplicate in any state) | 14 |
| Reaper: claim→commit→forward→ownership-guarded finalize; 1m/5m/30m (all three walked); dead_letter after 4 / on expiry; audit events | 15 |
| Reaper wired into `sigil relay up` for `queue`; in-memory + `queue` aborts | 16 |
| `sigil federation outbox list|show|retry` (no bodies; expired-retry refusal) | 17 |
| `sigil route test` (read-only, advisory same-owner line, sends nothing) | 18 |
| Observability: `federation.*` audit events via `recordAuditEvent` | 9, 11, 14, 15 |
| Loop prevention / SSRF / mutual pinning / per-origin rate scope / owner-assertion trust boundary | 4, 6, 8, 9 (behavioral); documented in CHANGELOG |
| Regression (no `--federation-mode`; no `--domain`; case-distinct federated ids) | 19 |
| `sigil init --federation-owner` test matrix (cross-domain accepted; plain `--owner` foreign still fails; omitted default; no partial file) | 1 |
| Postgres live-DB matrix (migration + methods + concurrency; `federation_hop` read-back) | 2, 13 |

No uncovered spec section.

**2. Placeholder scan**

Tasks 10, 13, 15, 17, 18 use prose sketches for parts of their test files ("fill in the world setup by copying…", "cases: …") rather than full literal test code, because those tests reuse large fixture helpers defined verbatim in Tasks 3/8/9 and copying 60+ lines per file into this plan adds no information. Each names the exact reference file and the exact assertions required. The **implementation** code in every task is complete and literal. If executing with subagents, the executor must copy the referenced fixture helper verbatim, not re-derive it.

**3. Type consistency**

- `decideRoute` returns `{ action, ... }` with `recipientDomain` on both `reject`-`PEER_NOT_PINNED`/`FEDERATION_HOP_EXCEEDED` (as `details.recipientDomain`) and `forward` (as top-level `recipientDomain`) — Task 4 defines it, Tasks 11/15 consume `route.recipientDomain` and `route.peer`. Consistent.
- `buildForwardRequest` → `{ body, canonicalBytes }`; `signForwardRequest(canonicalBytes, identity)` → `{ signature, keyId }`; `postForward(peer, canonicalBytes, { signature, keyId }, ...)` → `{ ok, status, peerCode? }`. Tasks 5, 6, 11, 15 agree.
- `verifyRelaySignature(parsedBody, { signature, keyId, peer })` → boolean. Tasks 7, 10 (via `acceptFederatedEnvelope`) agree.
- Peer record camelCase `{ domain, relayUrl, wsUrl, keys: [{ kid, alg, publicKey }], trustMode, ... }` — used identically in Tasks 4, 7, 8, 15, 18.
- `repository.persistAcceptedEnvelope({ ..., federation_hop })` — Task 2 adds the field; Task 9 sets it `true`. Snake_case `federation_hop` on the persisted row and in SQL; camelCase never used for this field. Consistent.
- Outbox repo methods camelCase params (`messageId`, `idempotencyKey`, `senderKey`, `senderOwnerId`, `recipientDomain`, `originDomain`) in Tasks 13/14/15; SQL columns snake_case. `rowToFederationOutboxRecord` is the single boundary. Consistent.
- Audit event type strings: `federation.queued`, `federation.forwarded`, `federation.forward_rejected`, `federation.forward_unavailable`, `federation.dead_letter`, `federation.inbound_accepted`, `federation.inbound_rejected` — spelled identically in Tasks 9, 11, 14, 15 and the spec's Observability section.
- New error codes and HTTP status: `PEER_NOT_PINNED` 400, `FEDERATION_HOP_EXCEEDED` 400, `FORWARD_MISCONFIGURED` 500, `FORWARD_REJECTED` 502, `FORWARD_UNAVAILABLE` 504 (origin, Task 11 `statusByCode`); `INVALID_FEDERATION_REQUEST` 400, `PEER_NOT_TRUSTED` 403, `RELAY_SIGNATURE_INVALID` 401, `SENDER_DOMAIN_FOREIGN` 403, `SENDER_OWNER_ASSERTION_MISMATCH` 403 (receiver, Tasks 8/9 local status map) — matches the spec's "Error code summary (new)" table exactly.

No inconsistencies found.

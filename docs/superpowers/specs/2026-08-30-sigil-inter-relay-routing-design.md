# Sigil inter-relay routing — design

## Problem

Federation decomposes into five sub-projects: (1) addressing, (2) inter-relay
trust/discovery, (3) inter-relay routing, (4) cross-federation
directory/presence, (5) operational tooling. Sub-projects #1 and #2 are built
and landed:

- **#1 addressing** (`sigil-repo/docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md`)
  made `endpoint_id`/`owner_id` optionally domain-qualified
  (`<local-part>@<domain>`). A domain-configured relay
  (`sigil relay up --domain <domain>`) checks every recipient at
  envelope-accept time: a foreign-domain recipient is rejected with
  `RECIPIENT_NOT_LOCAL`, a bare or malformed id with `MALFORMED_FEDERATED_ID`.
  That check lives in `checkRecipientLocality` (`sigil/relay/v1/validate-envelope.mjs`)
  and runs from both the legacy `validateEnvelope` path and the
  repository-backed `acceptWithRepository` path
  (`sigil/relay/v1/accept-envelope.mjs`).
- **#2 trust/discovery**
  (`sigil-repo/docs/superpowers/specs/2026-08-25-sigil-inter-relay-trust-discovery.md`)
  gave a relay operator a way to discover a foreign domain's relay endpoint
  and signing keys over HTTPS (`GET https://<domain>/.well-known/sigil`) and
  durably pin that trust (TOFU, fail-closed key-rotation detection) through a
  `sigil peer` CLI surface backed by a `PeerRelayRepository`
  (`upsertPeer`/`getPeerByDomain`/`listPeers`/`removePeer` on both
  `createMemoryRepository` and `PostgresRepository`). The publisher half,
  `sigil relay well-known generate`, emits this relay's `.well-known/sigil`
  document (`sigil/relay/v1/well-known-document.mjs`) from a designated
  endpoint identity: `{ domain, relay: { endpoint, ws_endpoint? }, keys: [{
  kid, alg: 'Ed25519', publicKey }] }`.

What is still missing is the delivery step. Today a domain-configured relay
that receives a well-formed envelope for a foreign domain rejects it. There
is no way for an endpoint on relay A to actually reach an endpoint on relay
B. This spec covers **only sub-project #3**: replacing that rejection with a
forward to the recipient's relay, using the peer records #2 already pins as
the sole set of legal forward targets.

### What #2 already guarantees that this spec builds on

- A pinned peer record carries a validated `relayUrl` (absolute, `https://`
  in production, no embedded credentials or path injection), an optional
  `wsUrl`, and a non-empty `keys` array of `{ kid, alg: 'Ed25519',
  publicKey }` where `publicKey` is base64url SPKI DER — byte-identical to
  what `sigil peer add --public-key` accepts and what
  `well-known-document.mjs` emits.
- Discovery never runs on the envelope-accept hot path and there is no
  background poller. `resolvePeer`/`rotatePeer` run only from an explicit
  `sigil peer` CLI invocation.
- Key-rotation acceptance is fail-closed: any change to a pinned `keys`,
  `relayUrl`, or `wsUrl` throws `PEER_KEY_MISMATCH` and requires
  `sigil peer rotate <domain> --confirm`.

### What already exists for delivery durability

A delivery reaper already runs once per minute
(`sigil-repo/docs/specs/sigil-policy-parameters-v1.0.md` §"Dead-letter reaper").
It claims rows transactionally, is bounded to 500 rows per pass, retries
`processing_failed` deliveries on a 1-minute / 5-minute / 30-minute schedule,
moves a delivery to `dead_letter` after three failed attempts or on
envelope expiry, emits an audit event per transition (state, attempt count,
reason code, timestamp — never the envelope body), and never auto-replays a
dead letter. Queue-mode federation retry (below) reuses this reaper and its
transactional-claim / audit-per-transition / no-auto-replay policy rather
than introducing a second timer. It diverges on one parameter: federation
uses `MAX_ATTEMPTS = 4` (final-review fix I4), dead-lettering after the
fourth failed attempt so all three backoff tiers (1m, 5m, 30m) are walked,
where the base delivery reaper stops at three.

## Decision

Introduce **opt-in synchronous or queued forwarding** of foreign-domain
envelopes to TOFU-pinned peer relays.

- A new flag, `sigil relay up --federation-mode sync|queue`, turns routing
  on. Unset preserves today's behavior exactly (`RECIPIENT_NOT_LOCAL`).
  `--federation-mode` requires `--federation-identity <path>` — the private
  identity file whose public half the operator has already published in
  this relay's `.well-known/sigil` `keys`. The relay process needs that
  private key in memory to sign outbound forwards;
  `sigil relay well-known generate` is an offline document emitter and does
  not give the running relay a signing key.
- Forwarding runs only on the repository-backed accept path
  (`acceptWithRepository`), which is what both `createMemoryRepository` and
  `PostgresRepository` relays use. The pure, repository-less
  `acceptEnvelope` fallback keeps `checkRecipientLocality` unchanged and
  returns `RECIPIENT_NOT_LOCAL` for a foreign recipient regardless of
  `--federation-mode` — it has no async seam to make an outbound call from.
- A relay only forwards an envelope it received from an authenticated local
  sender. An envelope that arrived over the federated-inbound path is never
  re-forwarded — one hop, always.
- The origin relay signs each forward with its `--federation-identity`
  signing key. The receiving relay verifies that signature against its
  own independently-pinned peer record for the origin domain (federation is
  mutual), then verifies the sender's envelope signature against a
  propagated sender public key, then delivers through the existing local
  pull/poll/stream path.
- Cross-owner federated first contact is out of scope (sub-project #4).
  Routing ships with the same-owner exemption only: a federated envelope is
  delivered without a directory link only when the origin relay's
  **relay-signed assertion** of the sender's `owner_id` is byte-equal to
  the local recipient's `owner_id` as held in the receiver's own registry.
  The receiver never uses `envelope.sender.owner_id` for this decision —
  see "Same-owner exemption" below.

### Prerequisite: sub-project #1 amendment (shared cross-domain owner id)

Sub-project #1's 2026-08-25 revision forces a supplied `--owner` to be a
federated id whose domain matches `--domain` (`OWNER_DOMAIN_MISMATCH`
otherwise). Under that rule a foreign sender's `owner_id` is always
`…@<origin-domain>` and a local recipient's is always
`…@<local-domain>`, so the two can never be byte-equal across a federation
boundary and the same-owner exemption could never fire.

This spec requires a narrow #1 amendment: `sigil init` gains a
`--federation-owner <federated-id>` flag that accepts an owner id whose
domain differs from `--domain`, suppressing `OWNER_DOMAIN_MISMATCH` for
that invocation only. Everything else in #1 is unchanged — an omitted
owner still defaults to `usr_<name>@<domain>`, and a plain `--owner` still
enforces the domain match. An operator who wants the exemption registers
the *same* `--federation-owner usr_chris@primary.example` on both relays;
the endpoints stay domain-local (`ep_codex@a.example`,
`ep_claude@b.example`) but resolve to one shared owner id. The amendment is
specified in full in the #1 spec's revision log as part of this
sub-project's implementation; it is called out here because #3 cannot be
planned without it.

### New module: `sigil/relay/v1/federation-router.mjs`

Pure-ish. Owns the forward decision and the outbound HTTP call. Takes the
peer directory (a repository) and a `fetchImpl` as parameters; owns no
storage.

- **`decideRoute(envelope, { relayDomain, federationMode, getPeerByDomain })`**
  → `Promise<{ action: 'local' } | { action: 'reject', code } | { action:
  'forward', peer }>`. Async because the pinned-peer lookup is a repository
  call; the accept transaction awaits it in place of today's synchronous
  `checkRecipientLocality`.
  - No `relayDomain` or no `federationMode` → `{ action: 'local' }` for a
    bare recipient, or delegates to the existing
    `MALFORMED_FEDERATED_ID`/`RECIPIENT_NOT_LOCAL` logic unchanged (routing
    disabled path).
  - Recipient domain equals `relayDomain` (case-insensitive, port
    significant — `isLocalDomain` semantics) → `{ action: 'local' }`.
  - Recipient domain is foreign, `federationMode` set, the envelope's
    stored row carries `federation_hop = true` → `{ action: 'reject',
    code: 'FEDERATION_HOP_EXCEEDED' }`. This is defense-in-depth only: an
    inbound federated envelope is delivered straight to a local recipient
    and never re-enters `POST /v1/envelopes` as an authenticated local
    send, so `decideRoute` is not normally reached for one. The check
    guards against a future code path that might route a stored envelope.
  - Recipient domain is foreign, `federationMode` set, no pinned peer →
    `{ action: 'reject', code: 'PEER_NOT_PINNED' }`.
  - Recipient domain is foreign, `federationMode` set, pinned peer exists →
    `{ action: 'forward', peer }`.
- **`buildForwardRequest(envelope, { originDomain, senderKey,
  senderOwnerId, now })`** → `{ body, canonicalBytes }` where `body` is the
  wire object below and `canonicalBytes` is its JCS (RFC 8785)
  canonicalization. **`canonicalBytes` is the single source of truth**: it
  is both the exact HTTP request body sent on the wire and the exact input
  to `signForwardRequest`. The caller never re-serializes `body`
  separately. Pure, no I/O.
- **`signForwardRequest(canonicalBytes, identity)`** → `{ signature, keyId
  }`. Ed25519 over `canonicalBytes` with the relay's `--federation-identity`
  signing key (the same identity `sigil relay well-known generate` used to
  publish this relay's public key).
- **`postForward(peer, canonicalBytes, { signature, keyId }, { fetchImpl =
  fetch })`** → `Promise<{ ok, status, peerCode? }>`.
  `POST {peer.relayUrl}/v1/federation/envelopes` with `canonicalBytes` as
  the raw body, `outboundFetchOptions()` (`AbortSignal.timeout(5000)`,
  `redirect: 'error'`), headers `Sigil-Relay-Signature` and
  `Sigil-Relay-Key-Id`. Never dereferences any envelope-supplied hostname;
  the target is always `peer.relayUrl` from the pinned record. Classifies
  the outcome: 2xx → `ok: true`; 4xx → `ok: false`, and `peerCode` is set
  only when the 4xx body parses as JSON within a **4 KiB read cap** and its
  `code` field is a string matching `^[A-Z][A-Z0-9_]{0,63}$` — otherwise
  `peerCode` is omitted and raw peer text is never surfaced or logged;
  timeout / transport error / 5xx → throws with
  `.code = 'FORWARD_TRANSPORT_FAILED'`.

### Wire format: `POST /v1/federation/envelopes`

Request body:

```json
{
  "origin_domain": "relay-a.example.com",
  "envelope": { "protocol": "sigil/1", "...": "the original signed sender envelope, verbatim" },
  "sender_key": { "kid": "ep_codex-2026-08", "alg": "Ed25519", "publicKey": "<base64url SPKI DER>" },
  "sender_owner_id": "usr_chris@primary.example",
  "forwarded_at": "2026-08-30T12:00:00.000Z"
}
```

Headers:

- `Sigil-Relay-Signature: <base64url Ed25519 signature>` — Ed25519 over the
  JCS-canonicalized request body bytes (the `canonicalBytes` above). The
  receiver parses the raw body, re-runs JCS canonicalization on the parsed
  object, and verifies the signature against *those* bytes — it never
  trusts the received byte order. JCS is deterministic, so verification
  succeeds iff the origin relay also signed canonical bytes.
- `Sigil-Relay-Key-Id: <kid>` — identifies which of the origin relay's
  published keys signed the request.

`sender_key` is the sender endpoint's public key as the origin relay holds
it in its registry, transported so the receiver can verify the envelope
signature end-to-end. Trust in that key is transitive — it arrives over a
channel authenticated by the pinned relay key — but the envelope signature
is actually checked on the receiving side, not passed through opaquely.

`sender_owner_id` is the origin relay's registry-backed assertion of which
owner the sender endpoint belongs to. It is covered by
`Sigil-Relay-Signature`, so the receiver trusts it exactly as far as it
trusts the pinned origin relay. It is the **only** value the receiver uses
for the same-owner exemption (step 8); `envelope.sender.owner_id` is the
sender's own claim and is used only for the consistency check in step 6.

`forwarded_at` is informational only — it is covered by the relay signature
but drives no receiver check. Freshness is enforced solely by the
envelope's own `created_at` / `expires_at` window.

`envelope` is byte-for-byte the sender's original signed envelope. The
origin relay does not re-sign or mutate it. There is no hop marker in this
body and none is needed: the receiver unconditionally stores its copy with
`federation_hop = true` (see step 10), and nothing in the wire format lets
a receiver — or needs to let a receiver — tell a "first hop" apart from a
"second hop." One-hop enforcement lives entirely on the origin side.

### Receiving side: `acceptFederatedEnvelope(body, headers, options)`

New route handler on `POST /v1/federation/envelopes`. Runs these checks in
order; the first failure returns immediately with the listed status/code
using the existing envelope error response shape
(`{ request_id, code, message, details }`):

1. **Structural.** `origin_domain` is a well-formed domain
   (`parseDomain`), `envelope` is an object, `sender_key` has non-empty
   `kid` / `alg === 'Ed25519'` / non-empty `publicKey`, `sender_owner_id`
   is a well-formed federated id (`parseFederatedId`). Failure →
   `400 INVALID_FEDERATION_REQUEST`.
2. **Origin pinned.** `getPeerByDomain(origin_domain)` on the *receiver's*
   peer directory. None → `403 PEER_NOT_TRUSTED`. Federation is mutual: a
   relay accepts forwards only from relays it has independently pinned.
3. **Relay signature.** Verify `Sigil-Relay-Signature` over the JCS body
   bytes against the pinned peer key whose `kid` equals
   `Sigil-Relay-Key-Id`. The match requires both `kid` and `publicKey` to
   correspond to the same pinned key entry (a spoofed request cannot reuse
   a known `kid` with a new key). Failure → `401 RELAY_SIGNATURE_INVALID`.
4. **Sender domain.** `parseFederatedId(envelope.sender.endpoint_id).domain`
   equals `origin_domain` (case-insensitive). An origin relay may only
   speak for its own domain. Failure → `403 SENDER_DOMAIN_FOREIGN`.
5. **Envelope signature.** Verify `envelope.signature` (Ed25519 over
   `signedBytes(envelope)`) against `sender_key.publicKey`. Failure →
   `401 INVALID_SIGNATURE`.
6. **Trimmed envelope validation + owner-assertion consistency.** Run
   `validateEnvelope` with a new `skipSenderRegistration: true` option:
   skip the `UNKNOWN_ENDPOINT` / `ENDPOINT_REVOKED` / sender-owner-match
   checks (the sender is by definition not registered on this relay), keep
   every other check — `protocol`/`message_type`/required fields,
   `created_at` / `expires_at` window, `MESSAGE_EXPIRED`,
   signature-metadata shape, replay detection (`REPLAY_DETECTED` on a
   reused `message_id` under a new `idempotency_key`). Then require
   `envelope.sender.owner_id === sender_owner_id` — the sender's own signed
   claim must agree with its relay's assertion. Mismatch →
   `403 SENDER_OWNER_ASSERTION_MISMATCH`.
7. **Recipient exists.** The recipient endpoint must exist and be `active`
   in the receiver's registry, using the exact federated id. Absent →
   `400 RECIPIENT_NOT_FOUND` (the same code and behavior local accept
   already uses).
8. **Directory gate — same-owner exemption only.** If the relay-attested
   `sender_owner_id` (verified in steps 3 and 6) is byte-equal to the
   recipient endpoint's `owner_id` as resolved from the receiver's own
   registry in step 7, delivery proceeds with no directory link.
   Otherwise → `403 DIRECTORY_LINK_REQUIRED`. Cross-owner federated first
   contact is sub-project #4; there is no cross-domain `directory_links`
   row type in this spec. `envelope.sender.owner_id` is never used here.
9. **Rate limits and inbox depth.** The existing reservations, keyed off
   the verified federated sender id: `['endpoint', sender.endpoint_id]`,
   `['owner', sender_owner_id]`, `['conversation', conversation_id]`, plus
   a new scope `['federation_origin', origin_domain]`. The unchanged
   recipient inbox-depth cap (1,000 open deliveries) also applies. Any
   failure → `429 RATE_LIMITED` / `429 QUOTA_EXCEEDED` as today.
10. **Persist and deliver.** Persist the envelope and its delivery row(s)
    through the existing local path, unconditionally setting
    `federation_hop = true` on the stored copy. Delivery to the local
    recipient is the unchanged pull / poll / WebSocket-stream path. Return
    `202 ACCEPTED` with `{ message_id, duplicate: false }`. An arriving
    request whose `(sender.endpoint_id, idempotency_key)` already resolves
    to a stored, accepted envelope returns `202 ACCEPTED` with
    `duplicate: true` and the original `message_id` — no second delivery
    row, no re-verification beyond the idempotency lookup. This covers the
    "peer accepted, origin lost the response, origin retries" case.

All repository work for steps 6–10 runs inside one transaction on one
client, matching `acceptWithRepository`'s existing structure. The
idempotency lookup that produces the `duplicate: true` path runs first
inside that transaction, before signature re-verification, exactly as the
local accept path already orders it.

### Origin side: how `--federation-mode` changes accept

`checkRecipientLocality` (or its call site in `acceptWithRepository`) is
replaced by a call to `federation-router.decideRoute`. The pure
`acceptEnvelope` fallback path is unchanged (see Decision).

On a `{ action: 'forward' }`, the origin relay assembles the wire body from
its own registry: `sender_key` and `sender_owner_id` are the public key and
owner id it holds for `envelope.sender.endpoint_id` (the authenticated
local sender). If that endpoint has no registered owner or key, the
forward is not attempted and the request fails `500 FORWARD_MISCONFIGURED`
— a local relay that accepted an authenticated send always has both, so
this is an invariant check, not an expected path.

- `{ action: 'local' }` → accept proceeds exactly as today.
- `{ action: 'reject', code }` → the request fails with that code:
  `RECIPIENT_NOT_LOCAL` (routing disabled, foreign recipient — unchanged),
  `MALFORMED_FEDERATED_ID` (unchanged), `PEER_NOT_PINNED` (new, `400`,
  `details: { recipientDomain }`), `FEDERATION_HOP_EXCEEDED` (new, `400`).
- `{ action: 'forward', peer }` → behavior depends on the mode.

**`sync` mode.** The forward happens inside the originating
`POST /v1/envelopes` request, before its response is returned. Nothing is
written to the origin relay's local `envelopes` / `deliveries` tables — the
recipient is not local.

- `postForward` returns `ok: true` → respond `202 ACCEPTED` with
  `forwarded: true`, `forwarded_to: <recipientDomain>`. Audit
  `federation.forwarded`.
- `postForward` returns `ok: false` (peer 4xx) → respond
  `502 FORWARD_REJECTED`, `details: { peerStatus, peerCode }`. A retry
  would not help (bad recipient, missing directory link, expired). Audit
  `federation.forward_rejected`.
- `postForward` throws `FORWARD_TRANSPORT_FAILED` (timeout / transport /
  peer 5xx) → respond `504 FORWARD_UNAVAILABLE`,
  `details: { recipientDomain }`. The envelope is **not** queued in `sync`
  mode; the sender re-sends. Audit `federation.forward_unavailable`.

> **Resolved (I1, `8fdd1fb` + `7d14e4a` + `e8bf8b7` + `fabb4fe`).** `acceptWithRepository`
> now runs in two phases. Phase 1 does the `decideRoute` lookup (read-only
> peers table, no client), the `reject`-route short-circuit, the
> sync-forward replay check (pool default, nothing written locally), and the
> `sync`-mode `forward` itself — all before `repository.withTransaction`
> opens. `postForward` no longer holds a database pool connection, so a slow
> or hung peer can no longer pin one or exhaust the pool. Phase 2 opens the
> transaction for `queue` forward (outbox INSERT + audit stay atomic) and
> `local` accept (unchanged). Phase 1 has its own `try/catch` that maps
> thrown rejects through `toResponse` and still emits the rejection audit
> for `AUDITED_REJECTION_CODES` (`7d14e4a`); the sender-key resolution no
> longer falls back to `lookupRecipientEndpoint` with a null client
> (`e8bf8b7`). The Phase 1 `try` was initially placed *after* the
> `decideRoute` call, so the common foreign-recipient throws
> (`RECIPIENT_NOT_LOCAL` / `MALFORMED_FEDERATED_ID`) escaped
> `acceptEnvelopeAsync` unhandled and left `main` red since `8fdd1fb`; the
> `try` now wraps `decideRoute` and `route` is hoisted to `let` for Phase 2
> (`fabb4fe`). One visible behaviour change: a reused `message_id` bound for
> an unpinned peer now returns `PEER_NOT_PINNED` (400) rather than
> `REPLAY_DETECTED` (409), because route validity is checked before replay.
> **`sync` mode is production-safe with respect to slow peers; `queue` mode
> remains the choice when at-least-once delivery across peer downtime is
> required.**

**`queue` mode.** Requires `--database-url` (the outbox is Postgres-only).

- On accept, write a `federation_outbox` row (envelope, `recipient_domain`,
  `origin_domain`, `sender_key`, `sender_owner_id`, `state: 'pending'`,
  `attempt_count: 0`, `next_attempt_at: now`) inside the accept
  transaction, then respond `202 ACCEPTED` with `queued: true`. Audit
  `federation.queued`. The insert is guarded by a `(message_id,
  idempotency_key)` unique constraint: a client retry that lands after the
  row already exists — in **any** state, including `forwarded` or a
  terminal state — is caught as a unique violation and returns
  `202 ACCEPTED` with `queued: true, duplicate: true`, inserting no second
  row and scheduling no second forward.
- **Claim / lease contract.** `federation_outbox.state` has a `processing`
  state and each row carries `claimed_at timestamptz` and `claim_token
  uuid` (both nullable). The reaper's federation step:
  1. In one transaction, `UPDATE federation_outbox SET state = 'processing',
     claimed_at = now(), claim_token = gen_random_uuid() WHERE id IN (
     SELECT id FROM federation_outbox WHERE (state = 'pending' AND
     next_attempt_at <= now()) OR (state = 'processing' AND claimed_at <
     now() - interval '300 seconds') ORDER BY next_attempt_at LIMIT 500 FOR
     UPDATE SKIP LOCKED ) RETURNING *`. The 300-second lease is far longer
     than the 5-second forward timeout, so a healthy pass never reclaims a
     peer's in-flight row; a crashed reaper's rows become reclaimable after
     it. A reclaim increments `attempt_count`, mirroring the delivery
     reaper's existing reclaim rule.
  2. Commit. Then, per claimed row, `buildForwardRequest` + `signForwardRequest`
     + `postForward` — the network call happens **after** the claim commits,
     which is why the lease, not the transaction, is what prevents a
     double-forward.
  3. Record the outcome with an ownership-guarded write: `UPDATE ... WHERE
     id = $1 AND claim_token = $2`. If the guard matches zero rows (the
     lease was stolen by a concurrent reaper after expiry), the result is
     discarded — the owning reaper will finalize.
  - `ok: true` → `state = 'forwarded'`, `claim_token = NULL`. Audit
    `federation.forwarded`.
  - `ok: false` (peer 4xx) → `state = 'forward_rejected'` (terminal, no
    retry), `claim_token = NULL`. Audit `federation.forward_rejected` with
    `peerCode`.
  - `FORWARD_TRANSPORT_FAILED` → `state = 'pending'`, `claim_token = NULL`,
    `attempt_count += 1`, `next_attempt_at` per the 1-minute / 5-minute /
    30-minute schedule; after the fourth failed attempt → `state =
    'dead_letter'`. Audit `federation.forward_unavailable` per attempt and
    `federation.dead_letter` on the final transition. `MAX_ATTEMPTS = 4`
    (final-review fix I4): federation retry diverges from the base
    delivery-reaper's three-attempt rule so all three backoff tiers
    (1m, 5m, 30m) are actually waited out before dead-lettering.
  - An envelope whose `expires_at` has passed before a successful forward →
    `state = 'dead_letter'`, reason `MESSAGE_EXPIRED`, no further attempts.
- The reaper never auto-replays a `dead_letter` or `forward_rejected` row.
  `sigil federation outbox retry <id>` moves one such row back to
  `state = 'pending'` with `attempt_count = 0`, `claim_token = NULL`,
  `next_attempt_at = now()`; it does not fabricate a new envelope — the
  stored signed envelope remains valid until its own `expires_at` (a retry
  of an already-expired row is refused with a message telling the operator
  to have the sender resend).

Both modes use the identical wire format and the identical receiving path.
`queue` only changes *when* the origin relay makes the call.

## Loop prevention, SSRF, abuse

- **One hop.** Enforced entirely on the origin side and structurally, not
  by any wire field. An envelope that arrives via
  `acceptFederatedEnvelope` is delivered straight to a local recipient's
  inbox and stored with `federation_hop = true`; it is never re-submitted
  to `POST /v1/envelopes` as an authenticated local send, so it never
  reaches `decideRoute` and cannot be forwarded onward. A chain A → B → C
  therefore cannot form. `decideRoute`'s `federation_hop` check is
  defense-in-depth for a hypothetical future path that routes a stored
  envelope. The receiver neither has nor needs a way to tell a first hop
  from a second hop.
- **No open redirect / SSRF.** The forward target is always `peer.relayUrl`
  from the TOFU-pinned directory record, already validated by #2 (absolute
  URL, `https://` in production, no credentials or path injection).
  Envelope-supplied hostnames are never used to choose a target.
  `redirect: 'error'` on the outbound fetch. No IP-range / loopback /
  private-range guardrail beyond what #2 established — consistent with this
  repo's existing outbound-fetch precedent (`oidc-client.mjs`,
  `peer-discovery.mjs`), explicitly accepted here.
- **Mutual pinning.** `acceptFederatedEnvelope` step 2 requires the
  receiver to have independently pinned the origin. A relay cannot push
  envelopes at a relay that has not opted into trusting it. `sigil peer
  remove <domain>` immediately stops accepting forwards from that origin.
- **Per-origin-domain rate scope.** The new `federation_origin` reservation
  bounds a single hostile or misconfigured pinned peer, in addition to the
  unchanged endpoint / owner / conversation scopes keyed off the verified
  federated sender id, and the unchanged recipient inbox-depth cap.
- **Envelope expiry** is enforced on the receiver (step 6) and by the
  queue-mode reaper: a forward that outlived `expires_at` is rejected
  `MESSAGE_EXPIRED` on arrival and dead-lettered rather than retried.
- **Owner-assertion trust boundary.** The same-owner exemption rests on
  `sender_owner_id`, which is only as trustworthy as the pinned origin
  relay. A compromised origin relay could assert any owner id, including
  one matching a local recipient's owner, and get a directory-link-free
  delivery. This is the same trust the operator already extended by
  pinning that relay in #2 (its relay key vouches for every sender on its
  domain); the exemption does not widen it, but the plan should state the
  blast radius explicitly.

## CLI and operator surface

- **`sigil relay up --federation-mode sync|queue --federation-identity
  <path>`** — the new relay flags. `--federation-mode` requires both
  `--domain` and `--federation-identity` (the private identity whose public
  key is in this relay's published `.well-known/sigil`; a mismatch is not
  detectable at startup but produces `RELAY_SIGNATURE_INVALID` at every
  peer, so document it as an operator responsibility). `queue` additionally
  requires `--database-url` / `SIGIL_DATABASE_URL`; an in-memory relay
  started with `--federation-mode queue` aborts at startup with a clear
  error. An invalid `--federation-mode` value, a missing
  `--federation-identity`, or an unreadable identity file aborts before the
  listener binds, matching how `--domain` is validated.
- **`sigil route test <recipient_federated_id> --identity <path>
  --relay-url <url>`** — read-only diagnostic. Parses the recipient,
  resolves its domain against the local peer directory, and reports:
  pinned yes/no, the peer `relayUrl`, and reachability
  (`GET {relayUrl}/v1/health`, the unauthenticated route `sigil doctor`
  already uses). It also prints an **advisory** same-owner line: a plain
  string comparison of the `owner_id` recorded in the supplied `--identity`
  file against the recipient's `owner_id` if that recipient is resolvable
  locally. This is a hint only — it compares what the identity file
  *claims*, not what the sending relay would *assert* at forward time, and
  the receiving relay re-checks against its own registry regardless. Sends
  no envelope.
- **`sigil federation outbox list|show <id>|retry <id>
  [--database-url <url>]`** — queue-mode inspection. `list` reports
  `pending` / `forward_rejected` / `dead_letter` counts and rows (no
  envelope bodies). `show <id>` prints one row's metadata and transition
  history. `retry <id>` re-queues one `forward_rejected` or `dead_letter`
  row. The command group is inert (empty) on a `sync`-mode relay because
  nothing is stored.
- **No new `sigil send` flags.** The sender posts to its home relay exactly
  as today and reads `forwarded: true` / `queued: true` / a `FORWARD_*`
  error code off the response. Federation is invisible to the sending
  endpoint.

## Observability

New audit event types, recorded through the existing
`repository.recordAuditEvent` (not the `writeRejectionAudit` retry wrapper,
which is specific to envelope-rejection transaction-rollback timing):

- `federation.queued` — queue mode, envelope written to the outbox.
- `federation.forwarded` — a `POST /v1/federation/envelopes` returned 2xx.
- `federation.forward_rejected` — peer returned 4xx; carries `peerCode`.
- `federation.forward_unavailable` — timeout / transport error / peer 5xx;
  carries `attempt_count` in queue mode.
- `federation.dead_letter` — queue mode, terminal after four failed
  attempts (`MAX_ATTEMPTS = 4`, I4) or on expiry; carries the reason code.
- `federation.inbound_accepted` — `acceptFederatedEnvelope` delivered a
  federated envelope locally.
- `federation.inbound_rejected` — `acceptFederatedEnvelope` rejected;
  carries the failing check's code.

Every event carries `origin_domain` and/or `recipient_domain`, the envelope
`message_id`, and `attempt_count` where relevant. None carries the envelope
body, matching the delivery-reaper audit rule. `GET /v1/audit` surfaces
them with all other audit events; no new query surface.

## Data model

New table `federation_outbox` (Postgres; queue mode only). Fields:

- `id` (uuid, pk)
- `message_id`, `idempotency_key` (from the envelope; `(message_id,
  idempotency_key)` unique to make enqueue idempotent under a client
  retry)
- `recipient_domain`, `origin_domain`
- `envelope` (jsonb — the verbatim signed sender envelope)
- `sender_key` (jsonb — `{ kid, alg, publicKey }`)
- `sender_owner_id` (text — the origin relay's owner assertion, written
  into the wire body at forward time)
- `state` (`pending` | `processing` | `forwarded` | `forward_rejected` |
  `dead_letter`)
- `attempt_count` (int, default 0)
- `next_attempt_at` (timestamptz)
- `claimed_at` (timestamptz, nullable — set when a reaper claims the row)
- `claim_token` (uuid, nullable — ownership guard for the finalizing write;
  cleared on every terminal or back-to-`pending` transition)
- `last_reason_code` (text, nullable)
- `created_at`, `updated_at` (timestamptz)

Indexes: `(state, next_attempt_at)` and `(state, claimed_at)` for the
reaper claim and lease-reclaim predicates, `(message_id, idempotency_key)`
unique. Repository methods on `PostgresRepository` only:
`enqueueFederationForward(row, client)` (returns `{ row, inserted }` —
`inserted: false` on a unique-constraint hit, carrying the existing row),
`claimDueFederationForwards(now, limit, leaseSeconds, client)`,
`finalizeFederationForward(id, claimToken, state, { attemptCount,
nextAttemptAt, reasonCode }, client)` (no-op when `claimToken` does not
match), `listFederationOutbox(filter)`, `getFederationOutboxRow(id)`,
`retryFederationForward(id, now, client)`. `createMemoryRepository` gets no
outbox methods; it rejects `queue` mode at startup instead.

The `envelopes` / `deliveries` schema gains one nullable column,
`federation_hop boolean` (default `false`), set `true` on a stored copy
that arrived via `acceptFederatedEnvelope`. `decideRoute` treats a truthy
value as a hard stop.

## Testing

- **`federation-router.mjs` unit** — `decideRoute` table: no
  `relayDomain`/`federationMode` → `local`; local-domain recipient →
  `local`; foreign + disabled → the unchanged `RECIPIENT_NOT_LOCAL` path;
  foreign + enabled + unpinned → `PEER_NOT_PINNED`; foreign + enabled +
  pinned → `forward` with the pinned `relayUrl`; a stored envelope carrying
  `federation_hop = true` → `FEDERATION_HOP_EXCEEDED`.
  `buildForwardRequest` JCS round-trip; the returned `canonicalBytes` is
  asserted to be both the signing input and the exact bytes handed to
  `postForward`. `postForward` with an injected `fetchImpl`: 2xx →
  `ok:true`; 4xx with a well-formed `{ code }` body → `ok:false` +
  `peerCode`; 4xx with a >4 KiB body, non-JSON body, or a `code` that
  fails the `^[A-Z][A-Z0-9_]{0,63}$` shape → `ok:false` with `peerCode`
  omitted; throw / 5xx / timeout → `FORWARD_TRANSPORT_FAILED`; target URL
  asserted to be `peer.relayUrl`, never an envelope field;
  `redirect: 'error'` asserted.
- **Wire signature** — `Sigil-Relay-Signature` computed over JCS body bytes
  round-trips against the origin relay's designated identity; the receiver
  re-canonicalizes the parsed body and still verifies (proving
  canonicalize-after-parse); a tampered body, a wrong `Sigil-Relay-Key-Id`,
  a `kid` reused with a swapped `publicKey`, and a body whose key order
  differs from canonical but whose signature was made over non-canonical
  bytes all fail closed.
- **`acceptFederatedEnvelope`** — structural garbage (including a malformed
  `sender_owner_id`) → `INVALID_FEDERATION_REQUEST`; unpinned origin →
  `PEER_NOT_TRUSTED`; bad relay signature → `RELAY_SIGNATURE_INVALID`;
  `sender.domain !== origin_domain` → `SENDER_DOMAIN_FOREIGN`; envelope
  signature not matching `sender_key` → `INVALID_SIGNATURE`;
  `envelope.sender.owner_id !== sender_owner_id` →
  `SENDER_OWNER_ASSERTION_MISMATCH`; unknown/inactive local recipient →
  `RECIPIENT_NOT_FOUND`; relay-attested `sender_owner_id` not equal to the
  local recipient's registry `owner_id` → `DIRECTORY_LINK_REQUIRED`;
  `sender_owner_id` equal to it → delivered and retrievable via the normal
  inbox poll and the WebSocket stream; expired envelope → `MESSAGE_EXPIRED`;
  replay of the same `message_id` under a new `idempotency_key` →
  `REPLAY_DETECTED`; a re-POST of an already-accepted
  `(sender.endpoint_id, idempotency_key)` → `202` `duplicate: true` with
  the original `message_id` and no second delivery row (the "peer accepted,
  origin lost the response, origin retries" case). Every accepted federated
  envelope's stored row is asserted to have `federation_hop = true`.
- **Sync mode** (`http-server.test.mjs`, injected `fetchImpl`) — peer 2xx →
  `202` + `forwarded: true` + `forwarded_to`, and nothing written to local
  `envelopes`/`deliveries`; peer 4xx → `502 FORWARD_REJECTED` with
  `peerStatus`/`peerCode`; peer throw/timeout → `504 FORWARD_UNAVAILABLE`
  and no outbox row; a local sender endpoint with no registered owner/key →
  `500 FORWARD_MISCONFIGURED` and no forward attempted.
- **Queue mode** — accept returns `202` + `queued: true` and writes one
  `federation_outbox` row (`state = 'pending'`); a reaper pass with an
  injected clock claims it (`state = 'processing'`, `claim_token` set),
  forwards it (2xx → `forwarded`, `claim_token` cleared); four injected
  transport failures — the first three each return the row to `pending`,
  walking the 1m / 5m / 30m backoff schedule in turn (`MAX_ATTEMPTS = 4`),
  and the fourth ends at `dead_letter` + a `federation.dead_letter` audit
  event; a peer 4xx during a reaper pass → `forward_rejected` (terminal); an
  expired envelope → `dead_letter` with reason `MESSAGE_EXPIRED`; a row
  stuck in `processing` past the 300 s lease is reclaimed by the next pass
  with `attempt_count` incremented; a `finalizeFederationForward` call with
  a stale `claim_token` is a no-op; a client re-POST after the row is
  already `forwarded` (or any state) returns `202 queued: true,
  duplicate: true` and inserts no second row; `sigil federation outbox
  retry <id>` moves a `dead_letter` row back to `pending` with
  `attempt_count = 0`; a retry of an already-expired row is refused.
- **CLI** — `sigil relay up --federation-mode bogus` aborts before binding;
  `--federation-mode queue` without `--database-url` aborts with a clear
  message; `--federation-mode sync` without `--domain` or
  `--federation-identity` aborts; `sigil route test` reports
  pinned/unpinned, reachability, and same-owner-exemption applicability
  without sending an envelope; `sigil federation outbox list` prints counts
  and rows with no envelope bodies.
- **Regression** — a relay with `--domain` but no `--federation-mode` still
  rejects a foreign recipient with `RECIPIENT_NOT_LOCAL` and still accepts
  a matching-domain recipient; a relay with no `--domain` runs no
  federation logic at all; two federated recipients differing only in
  local-part case remain distinct through the federated-inbound registry
  lookup.
- **Postgres** — the `federation_outbox` migration and its
  `PostgresRepository` methods run under the existing live-DB matrix job
  (Node 22.x/24.x, Ubuntu/Windows, PostgreSQL 16 service container),
  mirroring the `oidc_issuer_allowlist` and peer-repo test shape,
  including a two-concurrent-`claimDueFederationForwards`-callers test
  proving `FOR UPDATE SKIP LOCKED` + the `claim_token` guard never
  double-forward one row; the `federation_hop` column migration is
  exercised by an inbound-acceptance test that reads the stored row back.
- **`sigil init --federation-owner`** — a cross-domain owner id is accepted
  and written to both the identity file and `registry.json`; a plain
  `--owner` with a foreign domain still fails `OWNER_DOMAIN_MISMATCH`; an
  omitted owner still defaults to `usr_<name>@<domain>`; a failed
  `--federation-owner` leaves no partial identity file.

## Non-goals

- **No cross-owner federated first contact.** Cross-domain directory links
  and the invite / OIDC-match flow that would create them are sub-project
  #4. Routing ships with the same-owner exemption only, and that exemption
  works only when an operator has deliberately registered one shared
  `--federation-owner` id on both relays.
- **No general cross-domain owner identity.** The #1 amendment is the
  minimum: a single opt-in flag that lets one owner id be reused verbatim
  across relays. It adds no owner-id resolution, no owner directory, no
  proof that the two registrations are the same principal — that is #4.
  A byte-mismatch in the shared id just means no exemption, never an
  error.
- **No hot-path discovery or DNS.** Routing consumes only already-pinned
  peer records. An unpinned recipient domain is a hard `PEER_NOT_PINNED`
  reject. `sigil peer resolve` remains the only way to pin one.
- **No multi-hop or relay-transit networks.** Exactly one hop. A relay
  never forwards an envelope it received over federation.
- **No cross-federation delivery receipts or presence.** The origin relay
  learns forward-accepted versus forward-rejected. It does not learn
  read / acknowledge / process state on the far side. Heartbeats and
  delivery receipts remain relay-local.
- **No SSRF hardening beyond #2's.** The forward target is a validated,
  operator-pinned `relayUrl`; no additional IP-range or DNS-rebinding
  guardrail is added, consistent with the repo's existing outbound-fetch
  code.
- **No sender-visible federation API.** `sigil send` gains no flags and no
  awareness of domains. The only sender-observable change is the new
  `forwarded` / `queued` response fields and the `FORWARD_*` error codes.
- **No `queue` mode without Postgres.** The outbox is a Postgres table; an
  in-memory relay is sync-only and says so at startup.
- **No auto-migration or format change to existing envelopes or bare
  ids.** Bare ids remain valid forever on relays that never set `--domain`,
  unchanged by this spec.
- **No change to `.well-known/sigil` or the `sigil peer` surface.** This
  spec consumes #2's output as-is; it adds no discovery field and no peer
  subcommand.

## Error code summary (new)

| Code | HTTP | Side | Meaning |
|---|---|---|---|
| `PEER_NOT_PINNED` | 400 | origin | Routing on, recipient domain has no pinned peer record. |
| `FEDERATION_HOP_EXCEEDED` | 400 | origin | `decideRoute` reached for a stored envelope with `federation_hop = true` (defense-in-depth; not normally reachable). |
| `FORWARD_MISCONFIGURED` | 500 | origin | The authenticated local sender endpoint has no registered owner or key — an invariant violation, not an expected path. |
| `FORWARD_REJECTED` | 502 | origin | Peer relay returned 4xx for the forward; carries `peerStatus`/`peerCode`. |
| `FORWARD_UNAVAILABLE` | 504 | origin | Peer relay unreachable / timed out / 5xx; not queued in `sync` mode. |
| `INVALID_FEDERATION_REQUEST` | 400 | receiver | Malformed `/v1/federation/envelopes` body (includes a malformed `sender_owner_id`). |
| `PEER_NOT_TRUSTED` | 403 | receiver | Origin domain is not pinned in the receiver's peer directory. |
| `RELAY_SIGNATURE_INVALID` | 401 | receiver | `Sigil-Relay-Signature` failed verification against the pinned peer key. |
| `SENDER_DOMAIN_FOREIGN` | 403 | receiver | `envelope.sender` domain does not equal `origin_domain`. |
| `SENDER_OWNER_ASSERTION_MISMATCH` | 403 | receiver | `envelope.sender.owner_id` (sender's own signed claim) does not equal the relay-asserted `sender_owner_id`. |

Reused unchanged on the receiver: `INVALID_SIGNATURE`, `RECIPIENT_NOT_FOUND`,
`DIRECTORY_LINK_REQUIRED`, `MESSAGE_EXPIRED`, `REPLAY_DETECTED`,
`RATE_LIMITED`, `QUOTA_EXCEEDED`.

# Sigil cross-federation directory — design

## Problem

Federation decomposes into five sub-projects: (1) addressing, (2)
inter-relay trust/discovery, (3) inter-relay routing, (4) cross-federation
directory/presence, (5) operational tooling. Sub-projects #1, #2, and #3
are built and landed:

- **#1 addressing**
  (`sigil-repo/docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md`)
  made `endpoint_id`/`owner_id` optionally domain-qualified
  (`<local-part>@<domain>`), parsed only through
  `sigil/relay/v1/federated-id.mjs`. Its 2026-08-30 revision log adds
  `sigil init --federation-owner`, which registers one owner id verbatim
  across two domains so #3's same-owner exemption can fire.
- **#2 trust/discovery**
  (`sigil-repo/docs/superpowers/specs/2026-08-25-sigil-inter-relay-trust-discovery.md`)
  gave a relay operator a way to discover and durably TOFU-pin a foreign
  domain's relay endpoint and signing keys, exposed as
  `repository.getPeerByDomain(domain)` on both `createMemoryRepository`
  and `PostgresRepository`. Pinning is mutual: a relay pins each peer it
  intends to exchange traffic with, independently.
- **#3 inter-relay routing**
  (`docs/superpowers/specs/2026-08-30-sigil-inter-relay-routing-design.md`)
  replaced the `RECIPIENT_NOT_LOCAL` rejection of a foreign-domain
  envelope with an opt-in one-hop forward to a TOFU-pinned peer relay,
  synchronously or through a Postgres-backed `federation_outbox` drained
  by a federation reaper. The receiver's `acceptFederatedEnvelope`
  handler verifies the origin relay signature against its own
  independently-pinned peer record, verifies the sender envelope against
  a propagated sender key, then — at **step 8, the directory gate** —
  delivers only when the relay-attested `sender_owner_id` is byte-equal
  to the local recipient's `owner_id` (the same-owner exemption).
  Anything else is rejected `403 DIRECTORY_LINK_REQUIRED`.

What is still missing is cross-owner federated first contact. Today two
humans on two different relays can exchange envelopes only if an operator
has deliberately registered one shared `--federation-owner` id on both
relays. Two distinct owners — `usr_chris@a.example` and
`usr_bob@b.example` — have no path to authorise contact across the
federation boundary. #3 named this gap explicitly and deferred it:
"Cross-domain directory links and the invite / OIDC-match flow that would
create them are sub-project #4."

This spec covers **only the directory half of sub-project #4**: a
relay-forwarded invite-code on-ramp that produces a cross-domain
directory link, and the receiver-side enforcement change that lets an
active link satisfy #3's step 8. Cross-federation presence, reachability
signalling, and cross-federation delivery receipts are a separate later
sub-project and are non-goals here.

### What the local directory-trust spec already establishes

`sigil-repo/docs/specs/sigil-endpoint-directory-trust-spec-v1.0.md` covers
first-contact trust between two humans' endpoints **on a single shared
relay**. This spec reuses its model wholesale and extends it across a
federation boundary:

- A directory link answers "may these two endpoints exchange envelopes at
  all," a separate question from capability grants ("may this endpoint
  invoke this action"). The two stay separate tables with separate
  revocation lifecycles.
- Two on-ramps produce a link: an invite code (no identity provider
  needed) and an OIDC match (needs a shared allow-listed issuer). Neither
  writes a link row directly; both first produce a request record that
  resolves into a link only once both endpoints are known and both humans
  have confirmed.
- Invite redemption sets the redeemer's confirmation immediately —
  redeeming a code someone handed you is consent to be findable by them —
  but still requires the issuer's separate confirmation before the link
  activates.
- Confirmation is actor-bound: setting a side's confirmation requires an
  authenticated **human session** for that side's human, never mere
  possession of an endpoint's Ed25519 key.
- Enforcement is **forward-only**. Revocation never retroactively
  invalidates delivered mail; it rejects queued and future envelopes at
  their next delivery or accept.
- Every directory table already carries a `home_relay` column, added by
  the local spec's §9 as federation groundwork so a cross-relay version
  is an application-logic change, not a breaking migration.

### What #3 already guarantees that this spec builds on

- `POST /v1/federation/envelopes` with relay-signature authentication:
  `Sigil-Relay-Signature` (base64url Ed25519 over the JCS-canonicalized
  request body) and `Sigil-Relay-Key-Id`. The receiver re-canonicalizes
  the parsed body and verifies against those bytes — it never trusts the
  received byte order.
- `verifyRelaySignature` and the mutual-pinning check (the origin domain
  must be pinned in the receiver's own peer directory, else
  `403 PEER_NOT_TRUSTED`).
- `federation_outbox` (Postgres, queue mode) plus the federation reaper:
  transactional `FOR UPDATE SKIP LOCKED` claim with a 300-second lease
  and a `claim_token` ownership guard, a 1-minute / 5-minute / 30-minute
  retry schedule, `MAX_ATTEMPTS = 4` before `dead_letter`, and an audit
  event per transition that never carries an envelope body.
- The origin relay holds a `--federation-identity` signing key in memory;
  its public half is published in this relay's `.well-known/sigil`.

## Decision

Add a **relay-forwarded invite-code on-ramp** that produces a
`federation_directory_links` row on both participating relays, and make an
active such row a second way to pass #3's `acceptFederatedEnvelope` step
8.

- A new self-describing invite code,
  `sigil-fed-invite:<issuer-domain>:<base64url-random>`, is minted by the
  issuer relay and shared out-of-band by the issuing human. It is
  redeemable only on a relay that the issuer relay has named as the
  intended peer and that has the issuer relay pinned.
- The redeeming human redeems on **their own** relay (they have no
  session on the issuer relay). The redeeming relay posts the redemption
  to the issuer relay over a new relay-authenticated route. Each relay
  independently writes its own half of the cross-domain link.
- Each human's confirmation is set locally by an authenticated human
  session on that human's own relay. The other side's confirmation
  arrives as a signed relay-to-relay message. A relay's link row becomes
  `active` only when it holds both confirmations.
- `acceptFederatedEnvelope` step 8 gains a second pass condition: after
  the same-owner exemption (checked first, unchanged), an **active
  `federation_directory_links` row on the receiving relay** linking the
  relay-attested `sender_owner_id` to the local recipient's `owner_id`
  also permits delivery. Neither condition met → the existing
  `403 DIRECTORY_LINK_REQUIRED`.
- The origin relay's forward carries **no** link claim. The receiver's
  own active-link row is the sole authority for step 8, so a compromised
  origin relay cannot manufacture the **receiver-side** authority for a
  cross-owner delivery — that requires the receiving human's own action
  on the receiving relay. What each relay *does* vouch for, and what a
  compromised relay can therefore forge for its own domain's owners, is
  its own humans' consent acts: a redeeming relay's "this human redeemed
  the code" and an issuing relay's "this human confirmed the link." That
  trust is exactly #3's `sender_owner_id` trust — bounded by mutual peer
  pinning, no wider — and is stated as a boundary, not eliminated. See
  "Loop prevention, abuse, trust boundary" for the per-role blast radius.
- The three relay-to-relay messages (redemption posted, confirmation
  posted, revocation posted) are drained through #3's `federation_outbox`
  and reaper, extended with a `kind` discriminator, so cross-federation
  directory requires a Postgres relay on both ends. An in-memory or
  `sync`-only relay keeps local first-contact and #3 same-owner
  federation but not this feature; the limitation is asserted when a
  `sigil federation invite` command is invoked.

### Relationship to a future OIDC-match on-ramp

v1 is invite-code only. The schema keeps the invite record in its own
table and leaves `federation_directory_links.initiated_via` implicitly
`invite`, so adding an `oidc_match` on-ramp later is application logic
plus a match-request-propagation design, not a migration. Cross-relay
OIDC match is a non-goal of this spec.

## New module: `sigil/relay/v1/federation-relay-auth.mjs`

Extract #3's inbound relay-signature verification into a shared helper so
both `acceptFederatedEnvelope` and the new directory routes call one
implementation.

- **`verifyInboundRelayRequest(rawBody, headers, { getPeerByDomain })`**
  → `Promise<{ ok: true, originDomain, parsedBody }>` or throws
  `Object.assign(new Error(msg), { code, httpStatus })`. Steps:
  1. Parse `rawBody` as JSON; malformed → `400 INVALID_FEDERATION_REQUEST`.
  2. Read the claimed origin domain from `parsedBody.origin_domain`
     (envelopes) or `parsedBody.redeemer_domain` / the stored row's
     `peer_domain` for directory messages — the caller passes which field
     names the acting relay. `parseDomain` it; invalid →
     `400 INVALID_FEDERATION_REQUEST`.
  3. `getPeerByDomain(originDomain)` on the receiver's own directory.
     None → `403 PEER_NOT_TRUSTED`.
  4. Re-run JCS canonicalization on `parsedBody`. Verify
     `Sigil-Relay-Signature` against the pinned peer key whose `kid`
     equals `Sigil-Relay-Key-Id`; both `kid` and `publicKey` must belong
     to the same pinned key entry. Failure → `401 RELAY_SIGNATURE_INVALID`.
- #3's `acceptFederatedEnvelope` is refactored to call this helper for
  its steps 1–3. No behaviour change; the #3 regression suite must stay
  green.

## New module: `sigil/relay/v1/federation-directory-client.mjs`

Origin-side builders and the outbound HTTP call for the three directory
messages. Pure builders; one I/O function. Mirrors `federation-router.mjs`.

- **`buildRedemptionRequest({ linkRef, code, redeemer, redeemerDomain, now })`**
  → `{ body, canonicalBytes }`. `body` is
  `{ link_ref, code, redeemer: { owner_id, endpoint_id }, redeemer_domain,
  requested_at }` with `requested_at` = `now` ISO. `canonicalBytes` =
  `canonicalJsonBytes(body)`; it is the single source of truth — sent
  verbatim as the HTTP body and passed verbatim to the signer.
- **`buildConfirmationRequest({ linkRef, now })`** → `{ body, canonicalBytes }`,
  `body` = `{ link_ref, confirmed_at }`.
- **`buildRevocationRequest({ linkRef, now })`** → `{ body, canonicalBytes }`,
  `body` = `{ link_ref, revoked_at }`.
- **`signRelayRequest(canonicalBytes, identity)`** → `{ signature, keyId }`.
  Ed25519 over `canonicalBytes` with the relay's `--federation-identity`
  key. This is #3's `signForwardRequest` renamed; `signForwardRequest`
  stays as a re-export alias so #3 call sites are untouched.
- **`postDirectory(peer, path, canonicalBytes, { signature, keyId }, { fetchImpl = fetch })`**
  → `Promise<{ ok, status, peerCode? }>`. `POST` to
  `new URL(path, peer.relayUrl).toString()` where `path` is one of
  `/v1/federation/directory/redemptions`, `/confirmations`,
  `/revocations`. Options and outcome classification are identical to
  #3's `postForward`: `redirect: 'error'`, `AbortSignal.timeout(5000)`,
  headers `Sigil-Relay-Signature` / `Sigil-Relay-Key-Id` /
  `content-type: application/json`; 2xx → `{ ok: true, status }`; 4xx →
  `{ ok: false, status, peerCode? }` with `peerCode` set only from a
  ≤ 4 KiB JSON body whose `code` matches `^[A-Z][A-Z0-9_]{0,63}$`;
  timeout / transport error / 5xx → throw with
  `.code = 'FORWARD_TRANSPORT_FAILED'`. The target is always
  `peer.relayUrl` from the pinned record, never any message field.
  `postForward` is refactored to delegate to `postDirectory` with
  `path = '/v1/federation/envelopes'`.

## New module: `sigil/relay/v1/accept-federation-directory.mjs`

The three inbound handlers. Each runs on one transaction / one client,
matching `acceptWithRepository`'s structure. Each returns
`{ status, body: { request_id, code, message, details } }` on failure and
`{ status: 202, body: { … } }` on success.

### `acceptDirectoryRedemption(parsedBody, ctx)`

`ctx` carries `{ repository, client, originDomain, now, request_id }`
(`originDomain` is the verified posting relay from
`verifyInboundRelayRequest`).

1. **Structural.** `link_ref` is a uuid; `code` is a
   `sigil-fed-invite:<domain>:<segment>` string whose `<domain>` parses
   (`parseDomain`) **and equals this relay's own configured `--domain`
   case-insensitively** — a code whose embedded issuer domain names a
   different relay is rejected here even if `<segment>` would hash to a
   local invite row, so the self-describing domain the redeeming human
   saw is always the relay that actually processes the redemption;
   `redeemer.owner_id` and `redeemer.endpoint_id` are well-formed
   federated ids (`parseFederatedId`); `redeemer_domain` is a well-formed
   domain and equals `originDomain`;
   `parseFederatedId(redeemer.endpoint_id).domain` equals `originDomain`.
   Any failure → `400 INVALID_FEDERATION_REQUEST`.
2. **Invite lookup.** `repository.getFederationDirectoryInviteByHash(peerDomain
   = originDomain, codeHash = sha256(segment))`. Resolve the invite by
   `(peer_domain, code_hash)`. Absent, `status != 'pending'`, or
   `expires_at <= now` → `403 INVALID_FEDERATION_INVITE` (one generic
   code for all four cases — no oracle). An expired `pending` invite
   transitions to `expired` in this same transaction before the reject
   (lazy atomic, per local §7).
3. **Peer-domain match.** The invite's `peer_domain` equals `originDomain`
   (already used as the lookup key; re-assert defensively). Mismatch →
   `403 INVALID_FEDERATION_INVITE`.
4. **Idempotent replay.** If the invite is already `redeemed` **and** its
   `redeemed_by_owner_id` / `redeemed_by_endpoint_id` equal this
   request's `redeemer`, return `202` with the issuer identity and the
   stored `link_ref` — no second row, no state change. This covers the
   reaper re-draining an outbox row after the origin lost the response. A
   `redeemed` invite with a **different** redeemer → `403 INVALID_FEDERATION_INVITE`.
5. **Owner-pair collision.** If an earlier `pending` or `active`
   `federation_directory_links` row already exists on this relay for
   `(issuer_owner_id, redeemer.owner_id, originDomain)` under a
   **different** `link_ref` — the partial unique index would reject the
   insert — return `409 FEDERATION_LINK_EXISTS` with
   `details: { existing_link_ref }`. Deterministic, not the generic
   invite error: both parties are already authenticated and one is
   already a party to the existing link, so there is no enumeration
   concern. The reaper treats a `409` exactly like a peer `4xx` —
   `forward_rejected`, terminal, no retry; the issuing operator resolves
   it by revoking the stale link or reusing its `link_ref`. The invite is
   **not** marked `redeemed` in this branch (it stays `pending` until its
   own expiry or an explicit `invite revoke`).
6. **Write.** Mark the invite `redeemed` (`redeemed_by_*`, `redeemed_at`).
   `repository.createFederationDirectoryLink({ linkRef, localOwnerId =
   invite.issuer_owner_id, localEndpointId = invite.issuer_endpoint_id,
   remoteOwnerId = redeemer.owner_id, remoteEndpointId =
   redeemer.endpoint_id, remoteDomain = originDomain, role = 'issuer',
   status = 'pending', remoteConfirmedAt = now, localConfirmedAt = null,
   sourceInviteId = invite.invite_id, peerDomain = originDomain })`. This
   `INSERT` and the invite update commit in one transaction; a
   concurrent second redemption that lost the `getFederationDirectoryInviteByHash`
   `FOR UPDATE` race observes the invite already `redeemed` at step 4 and
   takes the idempotent-`202` branch (same redeemer) or the
   `INVALID_FEDERATION_INVITE` branch (different redeemer).
7. **Respond** `202` with
   `{ link_ref, issuer: { owner_id: invite.issuer_owner_id, endpoint_id:
   invite.issuer_endpoint_id } }`. Audit
   `federation_directory.redemption_accepted` and
   `federation_directory.link_created` (`role = 'issuer'`).

### `acceptDirectoryConfirmation(parsedBody, ctx)`

1. **Structural.** `link_ref` is a uuid; `confirmed_at` is an ISO
   timestamp. Failure → `400 INVALID_FEDERATION_REQUEST`.
2. **Link lookup.** `repository.getFederationDirectoryLinkByRef(linkRef,
   client)` with `FOR UPDATE`. Absent → `404 FEDERATION_LINK_NOT_FOUND`.
   The stored row's `peer_domain` must equal `originDomain` → else
   `403 PEER_NOT_TRUSTED`.
3. **Terminal / idempotent (revocation wins).** If the row's `status` is
   `revoked` or `expired`, return `202` no-op — a confirmation that
   arrives after revocation (a delayed or reaper-retried post) **never**
   reactivates the row. If `remote_confirmed_at` is already set and
   `status` is `pending` or `active`, also return `202` no-op
   (duplicate confirmation).
4. **Write (compare-and-set).**
   `setFederationDirectoryLinkConfirmation(linkRef, 'remote', now, client)`
   issues `UPDATE federation_directory_links SET remote_confirmed_at =
   $now, status = CASE WHEN local_confirmed_at IS NOT NULL THEN 'active'
   ELSE 'pending' END, updated_at = $now WHERE link_ref = $ref AND status
   = 'pending' AND remote_confirmed_at IS NULL`. If it updates zero rows
   (a concurrent revocation flipped `status` between the step-2 read and
   this write, despite `FOR UPDATE` this is defence-in-depth), treat it
   as the step-3 no-op. Audit `federation_directory.confirmation_accepted`
   on a non-zero update, and `federation_directory.link_activated` when
   the row moved to `active`.
5. **Respond** `202`.

### `acceptDirectoryRevocation(parsedBody, ctx)`

1. **Structural.** `link_ref` is a uuid; `revoked_at` is an ISO
   timestamp. Failure → `400 INVALID_FEDERATION_REQUEST`.
2. **Link lookup.** As confirmation. Absent → return `202` no-op (do not
   leak whether a link exists). `peer_domain != originDomain` →
   `403 PEER_NOT_TRUSTED`.
3. **Idempotent.** Already `revoked` → `202` no-op.
4. **Write.** `status = 'revoked'`, `revoked_at = now`, `revoked_by =
   'remote'`. Terminal. Audit `federation_directory.revocation_accepted`.
5. **Respond** `202`.

## New routes: `http-server.mjs`

Three routes, each: read the raw body, call
`verifyInboundRelayRequest(rawBody, headers, { getPeerByDomain })`, open a
transaction, dispatch to the matching `accept*` function, map the result
through the existing `{ request_id, code, message, details }` shape.

- `POST /v1/federation/directory/redemptions` → `acceptDirectoryRedemption`
- `POST /v1/federation/directory/confirmations` → `acceptDirectoryConfirmation`
- `POST /v1/federation/directory/revocations` → `acceptDirectoryRevocation`

All three require a repository-backed (Postgres) relay; on an in-memory
relay the routes return `501 FEDERATION_DIRECTORY_UNAVAILABLE`. They are
unauthenticated at the HTTP layer beyond the relay signature — there is
no endpoint session, exactly as `POST /v1/federation/envelopes`.

## Wire formats

### `POST /v1/federation/directory/redemptions`

```json
{
  "link_ref": "3f2a…-uuid",
  "code": "sigil-fed-invite:a.example:Yk9f…base64url",
  "redeemer": { "owner_id": "usr_bob@b.example", "endpoint_id": "ep_claude@b.example" },
  "redeemer_domain": "b.example",
  "requested_at": "2026-09-02T12:00:00.000Z"
}
```

Headers: `Sigil-Relay-Signature`, `Sigil-Relay-Key-Id` — Ed25519 over the
JCS-canonicalized body, verified after re-canonicalization on the
receiver. `requested_at` is informational, covered by the signature,
drives no check.

### `POST /v1/federation/directory/confirmations`

```json
{ "link_ref": "3f2a…-uuid", "confirmed_at": "2026-09-02T12:05:00.000Z" }
```

### `POST /v1/federation/directory/revocations`

```json
{ "link_ref": "3f2a…-uuid", "revoked_at": "2026-09-02T13:00:00.000Z" }
```

Both confirmation and revocation are keyed solely by `link_ref`; the
acting relay is authenticated by the relay signature, and the stored
row's `peer_domain` pins which relay is allowed to send them.

**Timestamp policy.** `requested_at` / `confirmed_at` / `revoked_at` are
covered by `Sigil-Relay-Signature` but are **audit metadata only** — no
handler branches on them. The receiver's own `now` is authoritative for
every stored `*_at` column and every freshness/expiry evaluation. A
skewed or future-dated value is recorded in the audit event as-received
and otherwise ignored; it is never used to order, gate, or reject a
message. Message freshness/replay is handled structurally, not by
timestamp: `link_ref` is minted once per invite and is `unique`, so a
replayed or reaper-retried post either lands on the idempotent branch of
its handler (same terminal state) or, if the owner pair has since been
re-invited under a **new** `link_ref`, fails `FEDERATION_LINK_NOT_FOUND`
against the stale ref rather than touching the new row.

## State machine

The full happy path across two relays, relay-a issuing to relay-b:

1. **`sigil federation invite create --peer b.example --endpoint
   ep_codex@a.example`** (relay-a, human A authenticated). relay-a mints
   `link_ref` (uuid) and a random code segment, stores a
   `federation_directory_invites` row (`status = 'pending'`, `code_hash =
   sha256(segment)`, `peer_domain = 'b.example'`, `expires_at = now +
   ttl`), prints `sigil-fed-invite:a.example:<segment>` once. No link row
   yet.
2. A shares the code with B out-of-band.
3. **`sigil federation invite redeem sigil-fed-invite:a.example:<segment>`**
   (relay-b, human B authenticated). relay-b parses the issuer domain
   `a.example`; requires `a.example` pinned (`getPeerByDomain`), else a
   clear "pin the peer relay first" error. relay-b writes its
   `federation_directory_links` row: `role = 'redeemer'`, `status =
   'pending'`, `local_confirmed_at = now` (redeeming a code is B's
   consent, per local §3.1.3), `remote_confirmed_at = null`,
   `remote_domain = 'a.example'`. Enqueues a `federation_outbox` row with
   `kind = 'directory_redemption'`, `idempotency_key = link_ref`,
   `message_id = link_ref` (synthesised so the existing unique index
   applies).
4. **Reaper drains** the `directory_redemption` row →
   `postDirectory(peerA, '/v1/federation/directory/redemptions', …)`.
   relay-a runs `acceptDirectoryRedemption`: validates the code, marks
   the invite `redeemed`, writes relay-a's link row (`role = 'issuer'`,
   `status = 'pending'`, `remote_confirmed_at = now`, `local_confirmed_at
   = null`), responds `202` with A's identity. On a `2xx` the outbox row
   is `forwarded`; on `4xx` it is `forward_rejected` (terminal — a bad or
   expired code will not become good); on transport failure it walks the
   1m/5m/30m schedule then `dead_letter`.
5. **`sigil federation link confirm <link_ref>`** (relay-a, human A
   authenticated, human session owner equals `local_owner_id`). relay-a
   runs the same `setFederationDirectoryLinkConfirmation(linkRef,
   'local', …)` compare-and-set — it sets `local_confirmed_at` and flips
   to `active` only `WHERE status = 'pending'`, so a concurrent
   `link revoke` (local or peer-originated) wins and the confirm is a
   no-op. On a non-zero update it enqueues `kind =
   'directory_confirmation'`; on a zero update it reports the link is
   already revoked/terminal and enqueues nothing.
6. **Reaper drains** the confirmation →
   `POST /v1/federation/directory/confirmations` to relay-b. relay-b runs
   `acceptDirectoryConfirmation`: sets `remote_confirmed_at = now`; both
   set → `status = 'active'`. `202`.
7. Link is `active` on **both** relays. A federated envelope
   `ep_codex@a.example` → `ep_claude@b.example` now passes
   `acceptFederatedEnvelope` step 8 on relay-b through the active link.

### Revocation

`sigil federation link revoke <link_ref>` on either relay. The local row
goes `revoked` immediately (terminal, `revoked_by = 'local'`). Enqueues
`kind = 'directory_revocation'`. The reaper posts
`POST /v1/federation/directory/revocations` to the peer, which sets its
row `revoked` (`revoked_by = 'remote'`). Enforcement is forward-only:
already-delivered envelopes are untouched; queued and future envelopes
are rejected `DIRECTORY_LINK_REQUIRED` at their next delivery or accept.
If the revocation post never lands, the reaper retries per #3's schedule;
until `dead_letter` the peer keeps delivering under the stale link. This
residual window is documented, matching local §8's forward-only stance —
an operator who needs a hard cut also removes the peer pin (`sigil peer
remove`), which stops all traffic at #3 step 2.

### Expiry

`federation_directory_invites` past `expires_at` transitions to `expired`
lazily and atomically on the next redemption attempt, per local §7.
Default TTL 24 hours, deployment-configurable within `[1h, 7d]`,
evaluated against the relay's own clock at use time. A `pending` link
whose confirmation never arrives has **no** auto-expiry in v1 — it sits
`pending` until `sigil federation link revoke`. The `expired` link status
stays reserved and unpopulated, exactly as in the local spec.

## Origin side: how a link changes `acceptFederatedEnvelope` step 8

Step 8 of #3's inbound handler becomes:

```
sameOwner = (senderOwnerId === recipientEndpoint.owner_id)   // #3, checked first, unchanged
if (sameOwner) {
  // deliver — proceed to step 9
} else {
  const link = await repository.getActiveFederationDirectoryLink(
    recipientEndpoint.owner_id,   // localOwnerId
    senderOwnerId,                // remoteOwnerId — relay-attested, verified in #3 steps 3 + 6
    origin_domain,               // remoteDomain
    client,
  );
  if (link) {
    // link.status === 'active' — deliver, proceed to step 9
  } else {
    return reject(403, 'DIRECTORY_LINK_REQUIRED', {
      reason: 'no_active_federation_directory_link',
    });
  }
}
```

- Runs in the same transaction / client as steps 6–10.
- `envelope.sender.owner_id` (the sender's own claim) is still never used
  for this decision — only the relay-attested `sender_owner_id`.
- No new error code. A missing, `pending`, `revoked`, or `expired` link
  is the existing `DIRECTORY_LINK_REQUIRED`. The only addition is
  `details.reason`, for audit clarity, distinguishing the same-owner path
  from the directory-link path.
- `getActiveFederationDirectoryLink` matches `status = 'active'` and the
  exact `(local_owner_id, remote_owner_id, remote_domain)` triple. The
  link is directional and pair-scoped: a link for `usr_bob@b.example`
  does not authorise `usr_dave@b.example`.

## CLI and operator surface

A new command group `sigil federation` gains `invite` and `link`
subgroups, siblings of #3's `sigil federation outbox`. All require
`--database-url` / `SIGIL_DATABASE_URL`; on a `sync`-mode or in-memory
relay they abort with the stated limitation.

- **`sigil federation invite create --peer <domain> --endpoint
  <federated-id> [--ttl <duration>]`** — issuer side. Requires an
  authenticated human session whose owner equals the endpoint's
  `owner_id` (an endpoint key alone cannot mint, matching local §5
  actor-binding). Validates `--peer` with `parseDomain` and
  `--endpoint`'s domain against the relay's own `--domain`. Prints
  `sigil-fed-invite:<domain>:<segment>` exactly once, plus the
  `link_ref`. Stores only `sha256(segment)`.
- **`sigil federation invite list`** — the issuer's invites: `link_ref`,
  `peer_domain`, `status`, `expires_at`. No hashes, no code segments.
- **`sigil federation invite revoke <link_ref>`** — issuer side. Moves a
  still-`pending` invite to `revoked` (terminal); a subsequent redemption
  of that code fails the generic `INVALID_FEDERATION_INVITE`. Refused if
  the invite is already `redeemed` (use `sigil federation link revoke`
  instead) or already terminal. Local-only — an unredeemed invite has no
  peer-side row to notify.
- **`sigil federation invite redeem <code>`** — redeemer side. Parses the
  issuer domain from the code, requires it pinned, writes the local
  `pending` link row (redeemer side confirmed), enqueues the redemption.
  Prints the `link_ref` and "waiting for issuer confirmation."
- **`sigil federation link list [--status <s>]`** — both roles:
  `link_ref`, `role`, `local_owner_id`,
  `remote_owner_id@remote_domain`, `status`, both confirmation
  timestamps.
- **`sigil federation link show <link_ref>`** — one row plus its
  transition history reconstructed from `federation_directory.*` audit
  events. No hashes.
- **`sigil federation link confirm <link_ref>`** — the issuer's explicit
  side confirmation. Requires an authenticated human session whose owner
  equals the row's `local_owner_id`. Sets `local_confirmed_at`,
  activates if both sides are set, enqueues the confirmation post.
  Refused if the row's `role` is `redeemer` (that side auto-confirmed at
  redemption) or the row is already terminal.
- **`sigil federation link revoke <link_ref>`** — either side. The local
  row goes terminal immediately; enqueues the revocation post. Refused
  only if the row is already `revoked`.

**`sigil route test`** (from #3) gains one advisory line: when the
recipient is foreign and not same-owner, it prints whether an active
`federation_directory_links` row exists locally for that owner pair —
`Directory link: active (link_ref <ref>)` or `Directory link: none —
delivery would be DIRECTORY_LINK_REQUIRED`. Advisory only; re-checked by
the receiving relay against its own registry; sends no envelope.

## Observability

New audit event types, recorded through `repository.recordAuditEvent`,
each carrying `peer_domain` and `link_ref`, none carrying an envelope
body:

- `federation_directory.invite_created`, `.invite_redeemed`,
  `.invite_expired`, `.invite_revoked`
- `federation_directory.link_created` (per relay; records `role`),
  `.link_confirmed` (records which side and the confirming human),
  `.link_activated` (fires once, on the second confirmation),
  `.link_revoked` (records `local` / `remote`)
- `federation_directory.redemption_posted` (origin, on outbox drain
  attempt), `.redemption_accepted`, `.redemption_rejected` (carries the
  failing check's code)
- `federation_directory.confirmation_posted`, `.confirmation_accepted`
- `federation_directory.revocation_posted`, `.revocation_accepted`

The reaper reuses #3's `federation.forward_unavailable` and
`federation.dead_letter` for the retry and terminal transitions of
`directory_*` outbox rows, adding the `kind` to the payload. Step-8
envelope rejections stay on the existing rejection-audit path with
`reason = DIRECTORY_LINK_REQUIRED`. `GET /v1/audit` surfaces all of these
with every other audit event; no new query surface.

## Data model

Migration `018_federation_directory.sql`.

### `federation_directory_invites` (issuer relay only)

| Column | Type | Notes |
|---|---|---|
| `invite_id` | uuid pk | `gen_random_uuid()` |
| `link_ref` | uuid not null unique | cross-relay correlation handle, minted here |
| `issuer_endpoint_id` | text not null | local federated id (the "A" side) |
| `issuer_owner_id` | text not null | local federated id |
| `peer_domain` | text not null | `parseDomain`-valid; the only relay allowed to redeem |
| `code_hash` | text not null | `sha256` of the random segment; plaintext never stored |
| `status` | text not null | check in (`pending`, `redeemed`, `expired`, `revoked`) |
| `redeemed_by_owner_id` | text | filled at redemption |
| `redeemed_by_endpoint_id` | text | filled at redemption |
| `redeemed_at` | timestamptz | |
| `expires_at` | timestamptz not null | |
| `home_relay` | text not null | deployment relay origin, per local §9 |
| `created_at` | timestamptz not null | |

`unique (peer_domain, code_hash)`. Index `(status, expires_at)` for lazy
expiry hygiene.

### `federation_directory_links` (both relays)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | local |
| `link_ref` | uuid not null unique | shared handle |
| `local_owner_id` | text not null | this relay's side |
| `local_endpoint_id` | text not null | |
| `remote_owner_id` | text not null | peer's side, plain validated federated-id text, no FK |
| `remote_endpoint_id` | text not null | |
| `remote_domain` | text not null | `parseDomain`-valid |
| `role` | text not null | check in (`issuer`, `redeemer`) |
| `initiated_via` | text not null default `'invite'` | check in (`invite`, `oidc_match`); only `invite` is populated in v1 |
| `status` | text not null | check in (`pending`, `active`, `revoked`, `expired`) |
| `local_confirmed_at` | timestamptz | |
| `remote_confirmed_at` | timestamptz | row is `active` only when both are set |
| `source_invite_id` | uuid | issuer relay only; nullable |
| `peer_domain` | text not null | equals `remote_domain`; the relay allowed to send confirmation/revocation |
| `revoked_at` | timestamptz | |
| `revoked_by` | text | check in (`local`, `remote`); nullable |
| `home_relay` | text not null | per local §9 |
| `created_at` | timestamptz not null | |
| `updated_at` | timestamptz not null | |

Constraints:

- `CHECK (local_owner_id <> remote_owner_id)` — a same-owner pair uses
  #3's exemption, never a link row.
- partial `unique (local_owner_id, remote_owner_id, remote_domain) WHERE
  status IN ('pending', 'active')` — one live link attempt per
  cross-domain owner pair; terminal rows stay for audit history and do
  not occupy the uniqueness slot. A new redemption against a pair with a
  live row fails with a specific (non-generic) "link already pending /
  active" error to the acting, already-authenticated party.
- Index `(status, local_owner_id, remote_owner_id, remote_domain)` for
  the step-8 lookup.

### `federation_outbox` change (from #3)

Add `kind text not null default 'envelope'` with `CHECK (kind IN
('envelope', 'directory_redemption', 'directory_confirmation',
'directory_revocation'))`. Existing rows default to `envelope`; the
existing `(message_id, idempotency_key)` unique index is unchanged.
Directory rows synthesise `message_id` and `idempotency_key` from
`link_ref` (redemption uses `link_ref`; confirmation uses
`link_ref || ':confirm'`; revocation uses `link_ref || ':revoke'`) so one
of each kind can coexist for a link. The reaper dispatches on `kind`.

### Repository methods

`PostgresRepository` gains, with `createMemoryRepository` parity where a
`sync`-only relay could still exercise the local half (invite create,
link create, confirm, revoke, list) but not the outbox-drained posts:

- `createFederationDirectoryInvite(row, client)`
- `getFederationDirectoryInviteByHash(peerDomain, codeHash, client)` —
  also performs the lazy `pending` → `expired` transition when
  `expires_at <= now`
- `markFederationDirectoryInviteRedeemed(inviteId, redeemer, now, client)`
- `revokeFederationDirectoryInvite(linkRef, now, client)` — `pending` →
  `revoked`; no-op / error when already `redeemed` or terminal
- `listFederationDirectoryInvites(filter)`
- `createFederationDirectoryLink(row, client)` — the `INSERT`; a
  partial-unique violation surfaces as a typed
  `FEDERATION_LINK_EXISTS` error carrying the existing row's `link_ref`,
  so the redemption handler's step-5 collision branch and the
  `sigil federation invite redeem` CLI path map it deterministically
  rather than leaking a raw constraint error.
- `getFederationDirectoryLinkByRef(linkRef, client, { forUpdate = false })`
- `setFederationDirectoryLinkConfirmation(linkRef, side, now, client)` —
  `side` in (`local`, `remote`). Compare-and-set: `UPDATE … SET
  <side>_confirmed_at = $now, status = CASE WHEN the other side's
  timestamp IS NOT NULL THEN 'active' ELSE 'pending' END WHERE link_ref =
  $ref AND status = 'pending' AND <side>_confirmed_at IS NULL`. Returns
  `{ updated: 0 | 1, activated: boolean }`. A zero update means the row
  was already `revoked` / `expired` / `active` or that side was already
  confirmed — the caller treats it as a no-op. **A `revoked` row is never
  moved back to `pending` or `active` by this method.**
- `revokeFederationDirectoryLink(linkRef, by, now, client)` — `by` in
  (`local`, `remote`). `UPDATE … SET status = 'revoked', revoked_at =
  $now, revoked_by = $by WHERE link_ref = $ref AND status IN ('pending',
  'active')`. Returns `{ updated }`; a zero update (already `revoked` /
  `expired`) is a no-op. Revocation always wins a race with a concurrent
  confirmation because both take `FOR UPDATE` on the row and the
  confirmation CAS additionally requires `status = 'pending'`.
- `listFederationDirectoryLinks(filter)`
- `getActiveFederationDirectoryLink(localOwnerId, remoteOwnerId,
  remoteDomain, client)` — the step-8 authority; returns the row only
  when `status = 'active'`

## Loop prevention, abuse, trust boundary

- **A link is not transitive and not multi-hop.** It authorises contact
  between exactly the two named owner ids across exactly the two named
  domains. It does not chain, and it does not interact with #3's one-hop
  forwarding rule — an inbound federated envelope still never re-forwards,
  so a link `a→b` plus a link `b→c` never yields an `a→c` path.
- **The receiver's active-link row is the sole step-8 authority.** The
  origin relay's forward carries no link claim. A compromised origin
  relay cannot manufacture the **receiver-side** authority for a
  cross-owner delivery: it can forward envelopes, but relay-b delivers
  them only if relay-b itself holds an active link, which required
  relay-b's own human session to redeem the out-of-band code.
- **Each relay vouches only for its own domain's humans, bounded by
  mutual pinning — the same trust as #3's `sender_owner_id`.** A relay's
  redemption post asserts "our human redeemed this code"; its
  confirmation post asserts "our human confirmed." A malicious or
  compromised **issuer** relay can mint invites naming its own endpoints
  for any `peer_domain` that pins it and can forge its own
  `local_confirmed_at` — but it cannot set the redeeming relay's
  confirmation, and the redeeming human sees the `link_ref` and issuer
  identity via `sigil federation link show` before contact matters. A
  malicious or compromised **redeemer** relay can forge a redemption
  (which counts as its human's consent, per local §3.1.3) and thereby
  populate the issuer relay's `remote_confirmed_at` without a real human
  B — but the issuer relay's own human still has to run
  `sigil federation link confirm` for the link to activate, and the
  worst outcome is that relay-a delivers A's envelopes to relay-b, which
  the attacker already controls. Neither role can forge a link that
  causes an **uncompromised** relay to deliver to a human who did not
  act. No silent link forms on an honest relay.
- **Mutual pinning gates every directory route.**
  `verifyInboundRelayRequest` requires the posting relay to be pinned in
  the receiver's own peer directory. `sigil peer remove <domain>`
  immediately stops accepting redemption / confirmation / revocation
  posts from that origin; existing `active` links are **not**
  auto-revoked (forward-only), but every subsequent envelope from that
  domain fails #3 step 2 `PEER_NOT_TRUSTED` before step 8 is reached. The
  spec advises operators to `link revoke` explicitly to clean the rows.
- **Redemption is a code-guessing surface.** The generic
  `INVALID_FEDERATION_INVITE` response (no distinction between wrong,
  expired, revoked, and unknown) is the first defence; a dedicated
  `federation_directory_redemption_inbound` rate scope keyed per posting
  peer domain is the load-bearing second. Guess-driven rejections consume
  quota; infrastructure failures do not, matching local §6.
- **New rate scopes:** `federation_directory_invite_create` (per issuer
  endpoint + owner), `federation_directory_redeem` (per redeeming
  endpoint + owner), `federation_directory_redemption_inbound` (per
  posting peer domain). Confirmation and revocation posts are bounded by
  #3's existing `federation_origin` scope; no new counter.
- **No SSRF hardening beyond #2/#3.** Directory posts target the pinned
  `peer.relayUrl` only, `redirect: 'error'`, consistent with the repo's
  existing outbound-fetch precedent.

## Testing

- **`federation-directory-client.mjs` unit** — each `build*Request`: JCS
  round-trip, `canonicalBytes` asserted to be both the signing input and
  the exact wire body; `postDirectory`: target URL is
  `peer.relayUrl` + the right path and never a message field, `redirect:
  'error'` asserted, 2xx → `ok:true`, 4xx with a well-formed `{ code }` →
  `ok:false` + `peerCode`, 4xx with a > 4 KiB / non-JSON / bad-shape
  `code` → `peerCode` omitted, throw / 5xx / timeout →
  `FORWARD_TRANSPORT_FAILED`. `postForward` still passes #3's suite after
  being refactored onto `postDirectory`.
- **`federation-relay-auth.mjs` unit** — a valid signed request passes;
  tampered body, wrong `Sigil-Relay-Key-Id`, a `kid` reused with a
  swapped `publicKey`, an unpinned origin, and a signature made over
  non-canonical bytes all fail closed with the listed codes. #3's
  `acceptFederatedEnvelope` regression suite is green after the refactor.
- **`accept-federation-directory.mjs` unit** (memory repo):
  - redemption — a good code writes a `pending` issuer-side link with
    `remote_confirmed_at` set and marks the invite `redeemed`; unknown,
    expired, revoked, and already-redeemed-by-another codes all return
    the one generic `INVALID_FEDERATION_INVITE`; an expired `pending`
    invite is transitioned to `expired` in the same transaction;
    `redeemer_domain` not equal to the verified `originDomain` →
    `INVALID_FEDERATION_REQUEST`; the redeemer endpoint's domain not
    equal to `originDomain` → `INVALID_FEDERATION_REQUEST`; a re-post by
    the **same** redeemer for an already-`redeemed` invite → `202` with
    the same `link_ref` and issuer identity, no second row.
  - confirmation — sets `remote_confirmed_at`, flips to `active` only
    when `local_confirmed_at` is also set; unknown `link_ref` → `404`;
    posting relay not equal to the row's `peer_domain` → `PEER_NOT_TRUSTED`;
    a repeat post → `202` no-op.
  - revocation — sets `revoked` / `revoked_by = 'remote'`; a repeat →
    `202` no-op; an unknown `link_ref` → `202` no-op (no existence leak);
    wrong posting relay → `PEER_NOT_TRUSTED`.
  - **race / replay** — a confirmation post that arrives after the row is
    `revoked` returns `202` and does **not** reactivate (revocation
    wins); a confirmation and a revocation applied concurrently leave the
    row `revoked` (both take `FOR UPDATE`, the confirmation CAS requires
    `status = 'pending'`); a duplicate confirmation after the row is
    already `active` is a `202` no-op; a stale confirmation carrying a
    `link_ref` whose owner pair has since been re-invited under a new
    `link_ref` → `404 FEDERATION_LINK_NOT_FOUND`, never touches the new
    row; a compromised peer's forged confirmation still only sets the
    peer-attested side and cannot set this relay's local human
    confirmation; an embedded issuer-domain in the code that is not this
    relay's `--domain` → `400 INVALID_FEDERATION_REQUEST`; two concurrent
    redemptions of the same code → one `202` + link row, the other
    idempotent `202` (same redeemer) or `INVALID_FEDERATION_INVITE`
    (different redeemer); a redemption for an owner pair with an existing
    live link under a different `link_ref` → `409 FEDERATION_LINK_EXISTS`
    with `existing_link_ref`, invite left `pending`.
- **Step-8 integration** (`accept-federated-envelope` tests) — same-owner
  still delivers with no link row; cross-owner plus an `active` link →
  delivered and inbox-visible; cross-owner plus a `pending`, `revoked`,
  or `expired` link, or no row → `403 DIRECTORY_LINK_REQUIRED` with
  `details.reason = 'no_active_federation_directory_link'`; a link for
  one remote owner does not authorise a different remote owner on the
  same domain; the check uses the relay-attested `sender_owner_id`, never
  `envelope.sender.owner_id`.
- **Reaper** (`federation-reaper.test.mjs` extension) — a
  `kind = 'directory_redemption'` row posts via `postDirectory` to
  `/redemptions`; `2xx` → `forwarded`; `4xx` → `forward_rejected`
  (terminal); transport failure walks 1m / 5m / 30m then `dead_letter`
  (`MAX_ATTEMPTS = 4`); `kind = 'envelope'` rows are unaffected; a mixed
  batch dispatches each row by `kind`.
- **CLI** — `invite create` prints a parseable
  `sigil-fed-invite:<domain>:<segment>` exactly once and persists only
  the hash; `invite create` without a human session for the endpoint
  owner aborts; `invite redeem` of a code whose issuer domain is unpinned
  gives a clear "pin the peer relay first" message; `invite redeem`
  writes the `pending` link and enqueues; `link confirm` by a human whose
  owner is not `local_owner_id` is rejected; `link confirm` on a
  `redeemer`-role row is rejected; `link confirm` activates and enqueues;
  `link revoke` from either role is terminal and enqueues; `invite revoke`
  moves a `pending` invite to `revoked` and a later redemption of that
  code then fails `INVALID_FEDERATION_INVITE`; `invite revoke` on an
  already-`redeemed` invite is refused; `link list` / `link show` /
  `invite list` print no hashes or code segments; every subcommand aborts
  without `--database-url`.
- **Postgres live-DB matrix** (mirrors #3's `federation_outbox` job) —
  `018` applies clean against a fresh DB; the partial unique index blocks
  a second `pending` / `active` link for one owner pair and allows a new
  row once the prior one is `revoked`; two concurrent redemption posts
  for one invite → exactly one `redeemed`, the other idempotent `202`,
  proven under `FOR UPDATE` row locking; the `federation_outbox` `kind`
  column is back-compatible (existing `envelope` rows read and drain
  unchanged); `getActiveFederationDirectoryLink` returns a row only in
  `active` state.
- **Regression** — a relay with `--federation-mode sync` (no Postgres)
  rejects `sigil federation invite create` with the documented
  limitation and returns `501 FEDERATION_DIRECTORY_UNAVAILABLE` from the
  three routes; a `--domain` relay with no `--federation-mode` runs no
  directory logic; the local `directory_links` path and its full
  test suite are byte-unchanged.

## Non-goals

- **No presence, reachability signalling, or cross-federation delivery
  receipts.** The origin relay learns redemption-accepted,
  confirmation-accepted, and forward-accepted; it never learns read,
  acknowledge, process, or online state on the far side. That is a
  separate later sub-project.
- **No cross-relay OIDC-match on-ramp.** v1 is invite-code only. The
  schema is shaped so a later `oidc_match` on-ramp is application logic
  plus a match-propagation design, not a migration.
- **No multi-hop or transitive directory.** One link authorises exactly
  one owner pair across exactly two domains, and never composes with
  another link or with #3's forwarding.
- **No auto-revocation on peer unpin.** `sigil peer remove` stops new
  traffic at #3 step 2; link rows persist until an explicit
  `link revoke`. Forward-only, matching local §8.
- **No `pending`-link expiry in v1.** An unconfirmed link sits `pending`
  until revoked; the reserved `expired` link status stays unpopulated.
- **No link-mediated capability grant.** A directory link authorises
  contact only. Capability grants stay separate and are not federated by
  this spec.
- **No in-memory or `sync`-only support.** The feature requires a
  Postgres relay on both ends; the limitation is asserted at command
  invocation and returned by the routes as
  `501 FEDERATION_DIRECTORY_UNAVAILABLE`.
- **No change to #3's envelope wire format, `.well-known/sigil`, or the
  `sigil peer` surface.** This spec adds routes and tables and consumes
  #2 and #3 output as-is.
- **No SSRF hardening beyond #2's.** Directory posts target the pinned
  `relayUrl`, `redirect: 'error'`, no additional IP-range or
  DNS-rebinding guardrail.

## Error code summary (new)

| Code | HTTP | Side | Meaning |
|---|---|---|---|
| `INVALID_FEDERATION_REQUEST` | 400 | receiver | Malformed directory-route body (reused from #3). |
| `INVALID_FEDERATION_INVITE` | 403 | receiver (issuer relay) | Redemption code is unknown, expired, revoked, already redeemed by another party, or `peer_domain`-mismatched — one generic code, no oracle. |
| `PEER_NOT_TRUSTED` | 403 | receiver | Posting relay is not pinned, or is not the relay named by the stored row's `peer_domain` (reused from #3). |
| `RELAY_SIGNATURE_INVALID` | 401 | receiver | `Sigil-Relay-Signature` failed verification (reused from #3). |
| `FEDERATION_LINK_NOT_FOUND` | 404 | receiver | Confirmation names a `link_ref` with no local row. |
| `FEDERATION_LINK_EXISTS` | 409 | receiver (issuer relay) | Redemption would create a second `pending`/`active` link for an owner pair that already has one under a different `link_ref`; carries `existing_link_ref`; reaper-terminal. |
| `FEDERATION_DIRECTORY_UNAVAILABLE` | 501 | receiver | Directory route hit on a non-Postgres relay. |

Reused unchanged: `DIRECTORY_LINK_REQUIRED` (403, receiver, step 8 — now
also raised when no active `federation_directory_links` row exists),
`FORWARD_TRANSPORT_FAILED` (origin, reaper), `RATE_LIMITED` /
`QUOTA_EXCEEDED` (receiver).

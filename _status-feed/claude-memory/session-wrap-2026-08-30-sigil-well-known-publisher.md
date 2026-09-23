---
name: session-wrap-2026-08-30-sigil-well-known-publisher
description: "Shipped `sigil relay well-known generate` (PR #2); roadmap #3 inter-relay routing is the next increment, deferred to a fresh session."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4c01cd12-1577-4469-b191-da94b2e23333
  modified: 2026-08-30T16:33:56.062Z
---

Session of 2026-08-30 (second wrap that day; see [[session-wrap-2026-08-30-kb-sync-drift-autoheal]]).

**Shipped:** `sigil relay well-known generate` in `C:\dev\sigil-repo`. Emits this relay's `.well-known/sigil` discovery document from a designated endpoint identity — the **publisher** half of the inter-relay trust/discovery sub-project (roadmap #2). Consumer `sigil peer resolve` already existed; loop now closed both halves.
- Branch `feat/relay-well-known-generate`, commit `fc22c9b`, pushed. **PR #2**: https://github.com/sorensencc-dotcom/sigil/pull/2
- New files: `sigil/relay/v1/well-known-document.mjs` (pure `buildPeerDocument`), `+ .test.mjs` (9 unit), `sigil/cli/sigil-relay-well-known.test.mjs` (8 CLI). Edited `sigil/cli/sigil.mjs` (`cmdRelayWellKnown` + dispatch + usage), `bin/sigil.mjs` help, `TODOS.md` (removed the closed publisher item), `docs/meta/sigil-cli-roadmap.md`.
- `keys[].publicKey` encoding contract: base64url of DER SPKI Ed25519 key, byte-identical to what `sigil peer add --public-key` takes.
- Full suite 678 pass / 0 fail / 67 skipped (live-DB); `audit:deps` + `audit:jcs` clean; pre-push hook green.

**Next session — roadmap #3: inter-relay routing.** Architectural (new subsystem): brainstorm -> spec -> writing-plans -> implement.
- Substrate that exists: `peer_relays` table + `resolvePeer`/`rotatePeer`/`listPeers()` in `sigil/relay/v1/peer-discovery.mjs` + `postgres-repository.mjs`.
- No relay-to-relay envelope forwarding anywhere yet (grep confirmed).
- Spec ref: `docs/superpowers/specs/2026-08-24-sigil-federated-addressing.md` (#3 listed, unspec'd). Also `docs/meta/sigil-cli-roadmap.md`.
- Deferred `TODOS.md` items that touch routing: transaction-wrap mutation+audit writes in `postgres-repository.mjs`, CAS on peer upserts, `sigil doctor` peer health-ping.
- `STATUS.md` active goal is unrelated (Local Revocation Cache release notes / downstream connector integration) — don't lose that thread.

Sigil canonical checkout is `C:\dev\sigil-repo` (not `sigil`). Preflight: `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`.

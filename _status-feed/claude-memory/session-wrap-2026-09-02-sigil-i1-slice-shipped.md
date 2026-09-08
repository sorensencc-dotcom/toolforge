---
name: session-wrap-2026-09-02-sigil-i1-slice-shipped
description: "I1 sync-forward txn-boundary slice for Sigil federation #3 — 3 fix commits shipped to sigil-repo main, closing defects in the auto-committed I1 core"
metadata: 
  node_type: memory
  type: project
  originSessionId: b0680c12-5308-4dff-8f41-b724206bae89
  modified: 2026-09-02T21:10:15.771Z
---

Sigil federation #3 I1 ("lift sync forward off the accept transaction") slice — SHIPPED 2026-09-02.

## What landed

`git push origin main` on `sigil-repo`: `85e818a..fabb4fe`. Five commits:
- `c6200d1` — ollama live-test race fix (pre-existing, unpushed before this session)
- `8fdd1fb` — I1 core (Phase 1 route decision / Phase 2 txn split). **Landed unprompted
  by the sigil-repo auto-commit process** before this session, past the 2026-09-02 handoff
  that said "I1 plan REVIEWED, not ready to implement".
- `7d14e4a` — **R1**: `8fdd1fb`'s Phase 1 catch skipped the rejection-audit write on a
  false premise; `REPLAY_DETECTED` IS in `AUDITED_REJECTION_CODES`. Restored + test.
- `e8bf8b7` — **R2/S1**: `forwardEnvelope` sender-key fallback hit
  `postgres-repository.mjs:79` `lookupRecipientEndpoint(id, null)` hard-throw on the sync
  path (null client). Gated fallback on truthy client → 500 FORWARD_MISCONFIGURED. + test.
- `fabb4fe` — **B1-completion**: `8fdd1fb` placed the Phase 1 `try` AFTER the `decideRoute`
  call. `decideRoute` throws `RECIPIENT_NOT_LOCAL` / `MALFORMED_FEDERATED_ID` for the
  common foreign-recipient case → escaped `acceptEnvelopeAsync` unhandled. **Red on main
  since `8fdd1fb`** (`http-server.test.mjs:117`, `federation-regression.test.mjs`). Try now
  wraps `decideRoute`; `route` hoisted to `let` for Phase 2 access.

Spec doc `68adb185` on `c:\Dev` branch `spec/sigil-inter-relay-routing` (local only):
`docs/superpowers/specs/2026-08-30-sigil-inter-relay-routing-design.md` "I1 — PARKED"
blockquote rewritten to "Resolved". `sigil-repo/STATUS.md` already "Known limitations: None".

## Verified

Pre-push gate + full `node --test`: 845 tests, 760 pass, 0 fail, 85 skip (live-DB/ollama
env-gated), live-ollama test green. CI run `33683013747`: all 4 test-matrix jobs green
(Linux/Windows × Node 22/24). Only red = **Secret scan** job — `gitleaks-action@v2`
`missing gitleaks license` + GitHub API rate-limit. Pre-existing infra drift, not code;
needs `GITLEAKS_LICENSE` secret or action downgrade or `continue-on-error`.

## Watch-outs (repeat of prior sessions, still live)

- **`C:\dev\sigil-repo` has an active process that reverts UNSTAGED edits and can kill
  test runs mid-flight.** It wiped the `fabb4fe` change once before I committed it. Commits
  are safe. Not a git hook (only `pre-commit`=JCS, `pre-push`=audit+test). Disable before
  controlled work. See [[feedback_codex_scope_creep_autopush_sigil]].
- **`C:\dev` (outer repo) also mutated mid-session**: branch silently switched
  `spec/sigil-inter-relay-routing` → `chore/stale-model-pins`, 8 unrelated files pre-staged
  by another process. First spec-doc commit swept them onto the wrong branch; recovered via
  `reset --soft` + single-file extract + re-commit as `68adb185`.
- GitHub API rate limit (5000/hr) got exhausted — shared across tools/agents.

## Open / backlog (unchanged)

Sub-project #4 close-out: review-minors 4/5/6/7/12b, `pgcrypto` `CREATE EXTENSION` note.
Cosmetic: stale `?? null` comment at `accept-envelope.mjs` ~L106 (since `e8bf8b7`), fold
into next touch. Full detail: scratchpad `I1-STATUS.md` (session b0680c12).

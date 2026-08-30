---
name: feedback_sigil_relay_state_and_mailbox_ambiguity
description: "Sigil local relay (sigil relay up) is in-memory only and loses all queued state on restart; empty inbox is ambiguous between \"drained by a live watcher\" and \"never delivered\" — don't loop resends, ask for explicit ledger confirmation."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5ae3c205-297a-40a4-896d-c3fbc44ef13e
  modified: 2026-08-16T18:13:34.431Z
---

During the 2026-08-16 conformance-spec review session (see
[[session-wrap-2026-08-16-sigil-conformance-spec]]), several turns were
burned resending the same mailbox message because an empty
`GET /v1/inbox` response is ambiguous: it means either "the recipient's
`--watch` process already drained and acked it" (success) or "the relay
restarted and lost it" (failure) — and `sigil relay up` is an in-memory
foreground process with no persistence, so a relay death genuinely does
wipe queued messages.

**Why:** wasted ~4 resend/ping round trips before switching to asking
Codex to check their *local persisted ledger* (`.sigil/inbox.jsonl`,
landed via commit `a4dcc65`) instead of re-guessing from the relay's
raw, ambiguous inbox state.

**How to apply:** next time a Sigil send's fate is unclear, don't loop
resending the same content — send one short ping asking the recipient to
check their local ledger/persisted state for the specific `message_id`,
and wait for that explicit answer before resending. Also: this exact
ambiguity is what motivated workstream H (sender-side delivery receipts
+ heartbeat) in the conformance-gap spec — once implemented, this class
of confusion goes away because the relay pushes state back to the
sender instead of the sender having to infer it.

Separately: `C:\dev\sigil` and `C:\dev\sigil-repo` are two different git
checkouts of the same repo (`sorensencc-dotcom/sigil`). `sigil-repo` is
the canonical/active one (has newer commits, e.g. `inbox --wait`,
ledger persistence); `sigil` is stale, several commits behind. Confirmed
via `git log --oneline` comparison after initially working in the wrong
one. Always verify which checkout is ahead before starting Sigil work,
don't assume the more-obviously-named one (`sigil` vs `sigil-repo`) is
canonical.

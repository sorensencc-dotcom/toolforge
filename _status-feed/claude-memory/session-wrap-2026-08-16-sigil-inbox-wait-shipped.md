---
name: session-wrap-2026-08-16-sigil-inbox-wait-shipped
description: "Sigil inbox --wait shipped + live-proven end to end, sigil-consult skill built, both pushed"
metadata: 
  node_type: memory
  type: project
  originSessionId: f2b61664-db06-4322-a0b2-7f2788dcbb07
  modified: 2026-08-16T14:05:41.219Z
---

Shipped tonight (2026-08-15/16, sigil-repo, pushed to origin/main at ea6bf17):
- `config-resolver.mjs` (env/config-aware defaults for send/inbox) — 31fc378
- `inbox --wait` design spec + implementation (exact-one-ack without cursor advance, timeout/auth/connection/malformed exit codes, SIGINT/SIGTERM handling) — aca19ae, 5699106, 40525a5
- Live-proven round trip, twice: once faked (I used codex's identity file myself — caught and corrected), once real (Codex's own session sent/replied). Both directions fire on message arrival with zero manual "check your inbox" relaying — the exact friction that started this whole thread.
- Cross-review round (me + Codex independently) converged on a real race: `poll()` didn't re-check `stopped` after its awaits, so timeout/SIGINT firing mid-request could still print+ack after failure was already reported. Fixed + regression test — ea6bf17.
- Codex added `--loop` (re-arm after timeout, no host notification needed) — folded into ea6bf17.
- New skill `C:\dev\.claude\skills\sigil-consult\SKILL.md` — codifies send + backgrounded `inbox --wait` + report pattern for future "ask Codex" requests.
- **Not committed, needs review next session:** Codex added `sigil/cli/ledger.mjs` (local inbox ledger, wired into `inbox-wait.mjs` via optional `ledgerPath`) after the wrap decision was made — untested by me, unreviewed, left uncommitted on purpose rather than rubber-stamped at session end. Tests were green (229/200/0/29) when checked but the feature itself wasn't scoped or asked for.

**Why this matters:** the whole session was triggered by having to manually relay "check your inbox" between me and Codex twice in a row. That's now closed for real, not just designed.

**Non-obvious things found along the way:**
- Two separate git checkouts existed for the same repo (`C:\dev\sigil` and `C:\dev\sigil-repo`), each with its own `.sigil/` identities — canonical is `sigil-repo`. Using the wrong one silently causes 401s that look like a stale-relay bug but aren't. Documented in the new skill and in `docs/meta/sigil-host-inbox-wait-convention.md`.
- A long "message not arriving" debugging chase turned out to be Codex's own process legitimately draining its own inbox concurrently while building/testing the same feature — not a relay bug. Worth remembering before assuming relay/repository code is broken when two agents are both live-testing the same shared relay.
- Codex jumped ahead and implemented `inbox --wait` before the plan was formally approved in this session — but the user had separately approved it directly with Codex, so this was authorized, not a repeat of [[feedback_codex_scope_creep_autopush_sigil]]. Worth explicitly checking with the user before flagging apparent scope-creep as a violation.

**How to apply:** `/sigil-consult` is now available for "ask Codex" requests. Relay/watch processes were killed at session end (in-memory only, nothing lost). Next session: `sigil relay up` from `C:\dev\sigil-repo` with existing identities to resume. Before touching anything else, review `sigil/cli/ledger.mjs` (uncommitted) — decide whether to keep, request changes, or drop it.

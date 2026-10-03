---
name: session-wrap-2026-10-02-sigil-rooms-phase-1-done
description: "Sigil rooms phase 1 (relay rooms) executed via SDD on feat/sigil-rooms; all tests green; branch unpushed, awaiting push/PR decision"
metadata:
  node_type: memory
  type: project
  originSessionId: f0f75211-3014-4c21-8630-b80d22dffa03
  modified: 2026-10-02T22:31:28.362Z
---

Phase 1 of Sigil rooms finished on 2026-10-02 in `C:\dev\sigil-rooms-wt`, branch `feat/sigil-rooms`. HEAD is `64239cf`, 18 commits past the plan commit `436418d`. The branch has **no upstream and is not pushed**, and no PR is open. Follows [[session-wrap-2026-10-02-sigil-rooms-plan-ready]].

Evidence:
- unit: 1233 tests, 1086 pass, 146 skipped, 1 fail. The failure is the known p2p multiaddr load flake, which passed 4/4 when rerun alone.
- live: 161 tests, 160 pass, 0 fail, 1 skipped.

Deviations from the plan, all decided as rulings during the run:
- Room authorization runs after signature verification. The plan put it before, which leaked membership.
- Room route repository failures return 503. Before this, an error could crash the relay.
- Federated and forwarded envelopes are refused for room conversations. The Postgres direct-path member inserts skip rooms.
- `task.request` and `task.result` are dropped from room types until phase 3 adds an assignee binding.
- History items carry `canonical_bytes`.

Deferred items for phase 2 or later:
- Fan-out bypasses the inbox-depth quota.
- Fan-out ignores revoked endpoints.
- Agent tokens get `human_id = owner_id`, so agents can manage rooms. Confirm this is intended.
- Fan-out recipients receive the sender's streamSeq, which causes gap/resend noise for members who join mid-stream.
- Sync forward consumes an approval before the room refusal.
- `errors-and-states.json` lacks `DATABASE_UNAVAILABLE` and `UNAUTHENTICATED`.

Still open:
- (Resolved by main PR #17) npm package omitting `sigil/contracts/v1/*.mjs`.
- The user committed `51c49ab` mid-run (Floor Warden reply route, phase 6). It is on this branch.

Process lesson: `npm pack --dry-run` runs `prepack`, which is the full `node --test`. Use `--ignore-scripts` so it does not overlap a suite run.

**Why:** the user resumed phase 1 with a request for subagent-driven execution; this records the state at the stopping point.
**How to apply:** PR #18 CI all green (Linux/Windows, Node 22/24) at session end; awaiting merge. Next session = phase 2 (Claude + Codex bridges, session continuity, hop budget, per-agent rate limit, Stop). No phase 2 plan exists yet: start with superpowers:writing-plans from the spec "Agent bridges" + "Loop and cost control" sections, branched off main after #18 merges (or off feat/sigil-rooms if not). Carry the phase 2 follow-ups listed above into the plan.

Update (same day): the user chose option 3. Commits `a0624d1` and `cacbeba` raised the startup waits in the relay-subprocess tests from 5s to 15s, and the p2p multiaddr wait to 25s. The pushes had failed 3 times because the pre-push suite timed these tests out under machine load. The branch was then pushed with the hook passing (1233 tests, 1087 pass, 0 fail). PR: https://github.com/sorensencc-dotcom/sigil/pull/18. `main` PR #17 already fixed the missing package contract modules.

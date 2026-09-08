---
name: session-wrap-2026-09-01-sigil-routing-merged
description: "Sigil federation #3 (inter-relay routing) SDD — Task 19 + final whole-branch review + fix wave done; branch MERGED to sigil-repo main locally (5c389e9), not pushed; I1 sync-mode txn-boundary parked"
metadata: 
  node_type: memory
  type: project
  originSessionId: 99e5fb9e-d6b2-4587-a31d-eeb293ad3116
  modified: 2026-09-01T22:14:33.423Z
---

# Sigil federation #3 (inter-relay routing) — SDD complete, merged locally

Resumed the subagent-driven-development run for plan `2026-08-30-sigil-inter-relay-routing` after a session/rate-limit reset. Picked up at Task 19 (last task). Worktree `C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing`, branch `feat/federation-inter-relay-routing` off sigil-repo `main` @ 7c2e867.

## What landed this session
- **Task 19** (regression sweep + docs + close-out): 2 commits `f430c57` (regression tests + CHANGELOG + STATUS) + `6fb94ef` (Part B cleanup B1-B7, incl. R15 reaper poison-row dead-letter guard). Task-reviewed clean.
- **Final whole-branch review** (opus): "with fixes" — 1 Critical + 7 Important + 12 Minor. Load-bearing rulings (R10 shadow-upsert, R14/R16 CI test-guard env var) re-verified sound.
- **One fix wave** `965b968`: C1 postForward streaming read-cap (was `res.text()` buffering whole 4xx body — spec §172 violation); I2 `POST /v1/federation/envelopes` now gated on `federationMode` set (was mounted unconditionally → any upgraded relay with a pinned peer silently accepted unauthenticated federated inbound); I3 `registerFederatedSender` key_id-collision fail-closed (`FEDERATED_KEY_ID_COLLISION`); I4 reaper `MAX_ATTEMPTS` 3→4 so 1m/5m/30m all walk (30m tier was dead code); I5 `recordFederationAudit` explicit `outcome` per call site (`federation.queued` was logged `outcome:'rejected'`); I6 drop dead `--relay-url` from `route test`; I7 normalized owner-advisory lookup + coverage; minors m2/m3/m8/m9/m10/m11/m12a. Scoped re-review: all addressed, no new breakage.
- **Merge** (finishing-a-development-branch, option 1 = local merge): `git merge --no-ff` into `main` → merge commit **`5c389e9`**. One conflict, `sigil/cli/sigil.mjs` usage block (PR #2 `relay well-known generate` line vs federation `relay up` line) — kept both. Post-merge focused tests 68/68 + dep/jcs audits pass; `node --check` clean.
- Worktree removed; SDD workspace deleted. Ledger backed up (durable): `C:\Users\soren\.claude\projects\c--Dev\memory\_ref-sigil-federation-routing-sdd-ledger-FINAL.md` (1068 lines, all 21 rulings R1-R21a + backlog).

## CORRECTION (verified end of session, supersedes claims below)
- **The auto-commit hook/daemon in `C:\dev\sigil-repo` finished the merge unprompted.** `git merge --no-ff` stopped on the `sigil.mjs` conflict; seconds later `5c389e9` existed (message shortened, em-dash→hyphen, NOT verbatim), MERGE_HEAD gone, worktree deregistered by the hook. Resolution independently verified correct: `sigil/cli/sigil.mjs` = superset of both sides (well-known-generate cmds + federation dispatch); **full suite on `5c389e9` = 842 tests / 757 pass / 0 fail / 85 skip** (live-ollama passed that run). Disable that hook before any further controlled git op in sigil-repo. See [[finding-cic-ingestion-autocommit-push-daemon-2026-07-27]].
- **The `c:\Dev` doc edits did NOT land.** Verified: `docs/superpowers/plans/2026-08-30-sigil-inter-relay-routing.md` still 111 `[ ]` / 0 `[x]`; `...-design.md` has NO I1-PARKED blockquote and NO I4 `MAX_ATTEMPTS=4` wording — subagents claimed both, `git status`/grep show neither. The shipped `STATUS.md` "Known limitations" note (in the merge) IS the only in-repo record of the I1 sync-mode caveat. See [[feedback_verify_subagent_test_reports]].

## Prioritized next steps (fresh session)
1. Human eyeball merge `5c389e9` — the auto-hook resolved the `sigil/cli/sigil.mjs` conflict; spot-check dispatch chain + `cmdInit` usage strings + well-known import. Tests green but an automated resolver did it.
2. Decide push: `git push origin main` (27 ahead) or revert to a PR flow. If pushing → then prune `origin/feat/federation-inter-relay-routing` (@719d62c) + `git branch -D feat/federation-inter-relay-routing` local (@965b968, fully in main via 5c389e9).
3. Watch the CI live-DB matrix — first real execution of the whole federation Postgres path (R10 shadow-upsert, migration 017, `federation_outbox` claim/finalize/retry, I3 `FEDERATED_KEY_ID_COLLISION` guard, I5 audit outcome, I7b/m10 route-test cases). If red → migration 017 CHECK constraints, claim-SQL `::timestamptz`/`::double precision` casts, `ON CONFLICT (message_id, idempotency_key)` re-SELECT.
4. I1 follow-up (load-bearing, parked) — take the sync-mode `forward` branch off the transactional accept (nothing is written locally on that path). Own spec slice; contained lift was blocked by the shared decideRoute/replay/rejection-audit prologue. Sync mode not production-ready under slow peers until this lands; queue mode fine.
5. Doc debt (correction above): tick the 111 plan boxes; add I1-PARKED + I4 notes to the design spec. Low risk.
6. Backlog minors — see below.

## Parked / carry-forward
- **R21a — I1 (load-bearing, deferred):** sync-mode `postForward` runs a 5s outbound HTTP call INSIDE `repository.withTransaction` → slow peer = pool exhaustion for all relay traffic. Contained lift not safe within the no-second-review scope (forces reordering the shared decideRoute/replay/audit prologue). Documented in spec §327-337 + `STATUS.md` "Known limitations". **Queue mode (production path) unaffected. Sync mode not production-ready under slow peers until this lands.**
- **CI live-DB matrix is the first real execution** of the whole federation Postgres path (R10 shadow-upsert, migration 017, federation_outbox claim/finalize/retry, I3 collision guard, I5 audit outcome, I7b/m10 route-test cases). All were `SIGIL_TEST_DATABASE_URL`-gated + SKIPPED locally. If CI live-DB red, look there first.
- Backlog (sub-project #4 / close-out): review-minors 4 (claim/retry no updated_at bump), 5 (enqueue timestamps from caller now), 6 (lease-steal double-increments attempt_count — comment added), 7 (no https: scheme allowlist on peer.relayUrl), 12b (federation_outbox no retention/prune for terminal `forwarded` rows — unbounded JSONB growth). pgcrypto never `CREATE EXTENSION`d — 017 relies on PG13+ `gen_random_uuid()` builtin (header note added).

## State left for the operator
- `sigil-repo` **`main` @ `5c389e9`, 27 ahead of `origin/main`, NOT pushed** (option 1 was local merge only).
- Local branch `feat/federation-inter-relay-routing` @ `965b968` still exists — `git branch -d` refused (5 commits ahead of its stale `origin/feat/federation-inter-relay-routing` @ 719d62c, though fully in main via 5c389e9). Needs `git branch -D` to remove.
- Stale remote branches to prune when ready: `origin/feat/federation-inter-relay-routing` (@719d62c), `origin/feat/relay-well-known-generate`.
- **`c:\Dev` doc edits (R19) were NOT applied** — see CORRECTION above. Plan still 111 `[ ]`; spec missing I1/I4 notes.
- `sigil/scripts/live-ollama-worker-test.mjs` — pre-existing env flake (no local Ollama), flaps pass/fail across runs, unrelated to the diff, flagged across the whole branch. Passed on `5c389e9`.

## Cross-session note
`dev-93` was independently driving the same resume; confirmed I owned it, it stood down. Its Task-19 implementer produced the `f430c57`+`6fb94ef` lineage (single clean history, no duplicate commits); its independent Task-19 review also came back APPROVED.

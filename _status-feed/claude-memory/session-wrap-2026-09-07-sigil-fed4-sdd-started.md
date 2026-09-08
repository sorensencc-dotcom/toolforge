---
name: session-wrap-2026-09-07-sigil-fed4-sdd-started
description: "Sigil Fed #4 security SDD: Tasks 1-6 of 14 committed + review-clean; RESUME at Task 7 (ordering-locked)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 15145dc2-b190-4746-b1c8-085b7a6a70a0
  modified: 2026-09-08T00:48:55.621Z
---

Sigil cross-federation directory (#4) **security-hardening SDD: Tasks 1-6 of 14 done, all review-clean.** Supersedes [[session-wrap-2026-09-07-sigil-fed4-security-plan-written]].

**Branch `feat/cross-federation-directory`, HEAD `dbf3c83`. Non-DB suite 823 pass / 0 fail / 109 skip. DO NOT PUSH.** Branch base `b11dfc3`, plan commit `c47845a` (eng-reviewed, 5 findings A-E, A-D folded).

**Commits:** `c47845a`(plan) → `a424287`(T1 migration 019: `federation_relay_nonces` + 2 CHECK relaxations + redemption-code scrub) → `e934a41`(T2 `consumeRelayNonce`/`pruneRelayNonces` both repos) → `22cb8e8`(T3 `resolveRelayRequestFreshnessMs` clamp) → `4256239`(T4 `verifyInboundRelayRequest` freshness + nonce-format — **scope expanded by ruling** to also fix 4 downstream fixture files) → `d743706`(T5 builders emit `nonce`+`signed_at`, drop 4 timestamp fields) → `dbf3c83`(T6 `initiatedVia` write path + `fdlRowView` finding-A fix).

**SDD workspace:** `C:\dev\sigil-repo\.superpowers\sdd\2026-09-06-sigil-federation-directory-security\` — ledger `progress.md` has the full `=== HANDOFF ===` block, pre-flight conflict scan, all rulings, and per-task deferred-minor roll-up. All 14 briefs pre-extracted (`task-N-brief.md`).

**Rulings made (carry forward):**
- Baseline is 814/0/103 (plan said 812), now 823/0/109.
- T3: accept the `raw == null` guard (brief's `Number(null)===0` bug fails its own test).
- T4: scope expanded — the spec-mandated unconditional `signed_at`/`nonce` checks broke 24 downstream tests; Task 4 also updated fixtures in `http-server.federation-inbound.test.mjs`, `http-server.federation-directory.test.mjs`, `accept-federated-envelope.test.mjs`, `federation-regression.test.mjs`.
- T7 = ONE atomic commit (RED exploit + GREEN self-pair). No git worktree — in-place in `C:\dev\sigil-repo`.
- T10-13 Step-1 tests must be literal AAA code, not prose skeletons.

**CARRY-FORWARD obligations:**
- **Task 10**: thread server `now`/`freshnessMs` into `verifyInboundRelayRequest` at handler call sites AND revert 6 wall-clock-coupled fixtures to pinned `signed_at` (locs in ledger T4-minors). Fill the 4 prose test skeletons (T10/11/12/13 Step 1) with real code.
- **Task 7+**: check whether `acceptFederatedEnvelope` step 8's `createFederationDirectoryLink` call needs `initiatedVia` (it silently defaults `'invite'` now).
- Any task editing migration 019 must re-run `postgres-repository.migration-019.test.mjs` (T1 minor: it deletes 019's ledger row + replays).

**RESUME (fresh session):**
1. Preflight `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo` (PowerShell tool, not Bash). Confirm HEAD `dbf3c83`.
2. Read `.superpowers/sdd/2026-09-06-sigil-federation-directory-security/progress.md` (full HANDOFF).
3. Re-invoke `superpowers:subagent-driven-development` — ledger resumes at **Task 7** (ordering-locked, pg-gated). Then 8→14.
4. After Task 14: final whole-branch review (`review-package` MERGE_BASE `b11dfc3` HEAD, most-capable model), ONE fix wave if needed, one scoped re-review → delete workspace → `superpowers:finishing-a-development-branch`. **DO NOT PUSH.**

pg for gated tasks (T7/T10): `SIGIL_TEST_DATABASE_URL=postgres://sigil:sigil_password@localhost:55432/sigil_test`.

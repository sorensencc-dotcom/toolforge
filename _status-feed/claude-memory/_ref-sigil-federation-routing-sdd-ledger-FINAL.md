# SDD ledger — plan: C:\dev\docs\superpowers\plans\2026-08-30-sigil-inter-relay-routing.md

## Batch scope
Batch 1 = Tasks 1-3 ONLY. Stop after "Task 3: complete". Do NOT dispatch Task 4.
Spec: C:\dev\docs\superpowers\specs\2026-08-30-sigil-inter-relay-routing-design.md

## Setup (done 2026-08-30, prior session)
- Worktree: C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing
- Branch: feat/federation-inter-relay-routing off sigil-repo main @ 7c2e867
- npm install: done. Baseline: sigil/cli/init-domain.test.mjs 8/8 pass.
- Preflight required each session: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo

## Session 2 (2026-08-30) — preflight rerun
- verify-repo-context.ps1 -Path <worktree> => PREFLIGHT_PASS, branch feat/federation-inter-relay-routing, HEAD 7c2e867
- baseline sigil/cli/init-domain.test.mjs => 8/8 pass

## Preflight conflict scan (RAN 2026-08-30, session 2)

### Cross-task table (Batch 1 = Tasks 1-3)
| Pair | Shared file / interface | Producer -> Consumer | Finding |
|---|---|---|---|
| T1 x T2 | none | - | disjoint. T1=sigil/cli/sigil.mjs; T2=memory-repository.mjs + postgres-repository.mjs + migrations/017 | CLEAN |
| T1 x T3 | none | - | disjoint. T3=sigil/relay/v1/validate-envelope.mjs | CLEAN |
| T2 x T3 | none | - | disjoint files | CLEAN |
| batch -> later | T1 shared owner-id, T2 federation_hop plumbing, T3 skipSenderRegistration | consumed only by Tasks 4/8/9/10/13 | no intra-batch dep; nothing in 1-3 consumes another's output | CLEAN |

### Self-consistency table
| Task | Own text checked | Finding |
|---|---|---|
| T1 | Step-1 test 5 regex `/both --owner and --federation-owner/` vs Step-3 impl message `sigil init: pass at most one of --owner and --federation-owner` | CONFLICT — substring "both --owner and --federation-owner" absent from impl message; test 5 fails post-impl as written |
| T1 | cmdInit anchors (plan "lines 89-111/98-102") vs actual sigil.mjs: cmdInit@87, dynamic import of parseFederatedId+isLocalDomain@93, `const owner = opt(args,['owner']) ?? ...`@96, checks@98-99 | OK — line drift only; imports plan relies on exist; plan says "currently" |
| T1 | test helper `.sigil/<name>.identity.json`, endpoint_id/owner_id fields | OK — matches init-domain.test.mjs conventions. Registry `owner_id`-on-row not independently confirmed -> impl-time verify note |
| T2 | Step-3 snippet vs actual memory-repository.mjs persistAcceptedEnvelope@73-87 returning `{message_id,duplicate:false}` | OK — snippet matches current code verbatim; `_debugGetAuditEvents`@338 present |
| T2 | migration number 017 vs migrations/ (latest 016_peer_relays.sql) | OK — 017 is next free number |
| T2 | Step-1 test 1 first assertion guarded by `if (stored)` (vacuous pre-impl) | OK — plan Step 3 adds `_debugGetEnvelope`; assertion becomes real post-impl. Acceptable. |
| T3 | Step-1 tests vs "verify it fails" (Step 2). test1 supplies a MATCHING synthetic registered entry -> validateEnvelope passes today; test2 (empty map -> UNKNOWN_ENDPOINT) and test3 (expiry) are existing behavior. No genuine red test as written. | CONFLICT — Step 2 already flags this and prescribes the fix |
| T3 | test import `signedBytes` from validate-envelope.mjs | OK — `signedBytes` exported @ line 27 |

### Rulings (pre-execution)
- Ruling (T1): implementer MUST use a mutual-exclusion error message containing the exact
  contiguous substring `both --owner and --federation-owner` (e.g.
  `sigil init: both --owner and --federation-owner given; pass at most one`) so plan Task 1
  Step 1 test 5 passes unmodified. Spec revision-log wording ("mutually exclusive") is
  satisfied either way. — Cost if wrong: one string-wording tweak, visible in diff, trivially reverted.
- Ruling (T3): implementer MUST apply plan Task 3 Step 2's own contingency — make test 1 a
  genuine fail-first by setting the synthetic `registered` entry's `owner_id` to a value that
  MISMATCHES `envelope.sender.owner_id` (e.g. `usr_other@a.example`), so pre-impl it throws
  `ROUTE_NOT_AUTHORIZED` and post-impl (`skipSenderRegistration: true` skipping the owner
  check) it returns `accepted: true`. Tests 2 and 3 stay verbatim (regression guard + expiry
  still enforced). Confirm >=1 assertion fails before Step 3. This directly exercises the
  spec'd skip of the sender-owner-mismatch check. — Cost if wrong: one test-fixture value
  change, visible in diff, low risk.
- Impl-time verify notes (not blockers): T1 — confirm `addEndpointToRegistry` writes `owner_id`
  onto the endpoint row; T2 — preserve any existing duplicate-detection in persistAcceptedEnvelope
  (plan snippet may be simplified) and report which parts of `npm test` ran if no live DB locally;
  T3 — if `signedBytes` is named differently in the actual file, adjust the import.

## Progress
BASE for Task 1 = 7c2e8671b2a2e1367a142858fcebe6e80047ef88

### Task 1 — in progress
- Implementer (sonnet, agent aeba339d6abae2715) reported NEEDS_CONTEXT: plan defect.
  cmdInit runs `resolveDomainOrThrow(domain)` BEFORE owner logic; brief's tests all use
  `--domain a.example` (RFC 2606 reserved TLD, never DNS-resolves) so 4/5 tests cannot reach
  green and test 1's required fail-first isn't the one the impl fixes. Repo's own
  init-domain.test.mjs uses `--domain local` for cross-domain-owner cases.
- Ruling (T1 plan defect): approve swapping `--domain a.example` -> `--domain local` and the
  `@a.example` id assertions -> `@local` across all 5 brief tests; keep the cross-domain owner
  `usr_chris@primary.example` (parses without DNS; still domain != `local` so cross-domain
  coverage intact). Minimal fix, matches existing repo test convention; does not change the
  feature or assertions being tested. — Cost if wrong: test-only domain-literal churn in one
  new file, fully visible in diff, revertible.
- Implementer confirmed controller decision #3 (registry/identity owner_id): no gap, brief's
  writes are correct once the flag is added.
- Task 1 implemented + committed daa5fee (DONE_WITH_CONCERNS). Implementer stalled once at
  commit step (harness watchdog); resumed, finished clean. new test 5/5; init-domain.test.mjs
  8/8; npm test 734/667 pass/0 fail/67 skipped (live-DB), dep-audit + jcs-audit PASS.
  Concerns: (1) plan-defect already ruled; (2) cosmetic — cmdInit missing-<name> error still
  names only --owner (out of scope); (3) no push.
- Task 1 review: BASE 7c2e867 HEAD daa5fee; package review-7c2e867..daa5fee.diff (1 commit).
- Task 1 reviewer (sonnet): Spec ✅ compliant, Task quality APPROVED. Both controller rulings
  implemented as directed; test 1 verified genuine cross-domain (owner primary.example != relay
  local). No Critical/Important. No fix loop.
- Task 1: minor (deferred): sigil.mjs:146 missing-<name> usage string still names only --owner (out of scope; fix if a later task touches that path).
- Task 1: minor (deferred): sigil.mjs:121 usage() init line long, folds two parentheticals (cosmetic).
- Task 1: minor (deferred): init-federation-owner.test.mjs test 5 (both flags) doesn't assert no-partial-identity-file like tests 2/3 (impl throws before any write; behavior correct).
- Task 1: complete (commits 7c2e867..daa5fee, review clean)

### Task 2 — federation_hop schema + persist plumbing
BASE for Task 2 = daa5feea7137af8bb27902a01f24742e1773d816
- Implementer (sonnet, agent af0a546eb286ec8a7) NEEDS_CONTEXT: all 4 in-scope files done; `npm test`
  736/668 pass/1 fail/67 skipped. Single failure = `sigil/relay/v1/postgres-repository.test.mjs:28`
  mock-pool unit test hardcoding `assert.equal(insert.values.length, 20)`, now legitimately 21
  because the required `federation_hop` param was added ($21). Verified by controller: it is the
  only `values.length` assertion in that file; line 30 (`insert.values[19] === 'sha256:abc'`)
  stays valid since federation_hop was inserted before envelope_status, leaving action_hash at $20.
- Ruling (T2 regression): authorize the one-token edit `20` -> `21` at postgres-repository.test.mjs:28
  and fold it into Task 2's single commit. The stale count is a direct, necessary consequence of
  Task 2's own required schema change; fixing it is the same change, not scope creep. The plan's
  Task 2 File Structure simply didn't list this test. — Cost if wrong: one-character test edit in
  the same commit, fully visible in diff, trivially revertible.
- Task 2 implemented + committed 8bdbed8 (DONE_WITH_CONCERNS). Fix applied: postgres-repository.test.mjs:28
  `20`->`21` + added `assert.equal(insert.values[20], false)`. `npm test` green: 736 tests / 669 pass /
  0 fail / 67 skipped (live-DB), dep-audit + jcs-audit PASS, live-Ollama ran+passed.
  CONCERN (carry to final review): migration 017 NOT exercised against real Postgres locally
  (no SIGIL_TEST_DATABASE_URL; 67 live-DB suites skipped). CI live-DB matrix is its first real run.
- Task 2 files (5): sigil/migrations/017_federation_outbox.sql (new), sigil/cli/memory-repository.mjs,
  sigil/relay/v1/postgres-repository.mjs, sigil/relay/v1/postgres-repository.test.mjs,
  sigil/relay/v1/federation-hop-persist.test.mjs (new).
- Task 2 review package generated: .superpowers/sdd/2026-08-30-sigil-inter-relay-routing/review-daa5fee..8bdbed8.diff
  BASE daa5fee, HEAD 8bdbed8, 1 commit.

===================================================================
## RESUME HERE (fresh session) — 2026-08-30, controller handoff
===================================================================
State: Task 1 COMPLETE (daa5fee, review clean). Task 2 IMPLEMENTED + COMMITTED (8bdbed8),
       review NOT yet run. Task 3 NOT started.
Batch scope: Tasks 1-3 ONLY. Do NOT dispatch Task 4.

Next actions, in order:
1. Preflight: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing
   (expect PREFLIGHT_PASS, branch feat/federation-inter-relay-routing). Confirm HEAD == 8bdbed8.
2. Dispatch Task 2 TASK REVIEWER (sonnet). Inputs: task-2-brief.md, task-2-report.md,
   review package review-daa5fee..8bdbed8.diff. Feed reviewer these as context:
   - Global constraints (see plan Global Constraints + this ledger's scope line).
   - Controller ruling in force: the postgres-repository.test.mjs:28 `20`->`21` + added
     `assert.equal(insert.values[20], false)` is an AUTHORISED consequence of the required
     federation_hop INSERT param -> 5 files in the commit, not the brief's 4. Not scope creep.
   - Named risk to check: recount `$N` placeholders vs params array length for BOTH the
     envelopes INSERT and the deliveries INSERT; confirm postgres-repository.test.mjs
     lines ~29-30 (`insert.values[17]==='sig'`, `insert.values[19]==='sha256:abc'`) still
     index-correct (action_hash stays $20/index 19 since federation_hop was inserted before
     envelope_status).
   - Known ⚠️: migration 017 not exercised vs real Postgres locally; state what CI must confirm.
3. If review clean -> ledger "Task 2: complete (commits daa5fee..8bdbed8, review clean)".
   If Critical/Important -> fix loop (rounds 1-3 resume implementer agent af0a546eb286ec8a7;
   4-5 fresh + more capable). Minor -> log deferred, complete.
4. Task 3: run scripts/task-brief for task 3 (BASE = 8bdbed8, record git rev-parse HEAD first).
   Dispatch implementer (cheap/mid model — mostly transcription; plan Task 3 carries full code).
   CONTROLLER RULING already recorded for Task 3 (see "Rulings (pre-execution)" above):
   apply plan Task 3 Step 2's contingency — make test 1 a genuine fail-first by setting the
   synthetic `registered` entry's `owner_id` to a MISMATCH (e.g. usr_other@a.example) so
   pre-impl throws ROUTE_NOT_AUTHORIZED and post-impl (skipSenderRegistration:true) returns
   accepted:true. Tests 2 + 3 stay verbatim. Verify >=1 assertion fails before Step 3.
   Also verify `signedBytes` export name in validate-envelope.mjs (it IS exported, line 27).
5. Task 3 review (same loop). Then STOP — do not touch Task 4.
6. Final whole-branch review over Tasks 1-3: review-package with MERGE_BASE = 7c2e867 (branch
   start) -> HEAD; dispatch code-reviewer.md on most capable model; point it at the deferred-
   minor lines + the Task 2 live-DB ⚠️. ONE fix wave max, one scoped re-review, adjudicate residuals.
7. Finish: collect every `Ruling:` line into the final message under "Rulings I made" (order made,
   each with cost-if-wrong). Then delete workspace, use superpowers:finishing-a-development-branch.

Rulings made so far (for the finish list):
- R1 (T1): mutual-exclusion error message must contain substring `both --owner and --federation-owner`
  so plan Task 1 Step 1 test 5 passes unmodified. Cost if wrong: string-wording tweak, visible in diff.
- R2 (T1): plan defect — brief's tests used `--domain a.example` (RFC 2606, never DNS-resolves) but
  cmdInit runs resolveDomainOrThrow first. Swapped to `--domain local` + `@local` id assertions in
  the new test file only; kept cross-domain owner usr_chris@primary.example. Cost if wrong: test-only
  domain-literal churn in one new file.
- R3 (T2): authorized `20`->`21` + added assertion at postgres-repository.test.mjs:28, folded into
  Task 2's commit. Stale hardcoded count is a direct consequence of Task 2's required schema change.
  Cost if wrong: one-token test edit in the same commit.
- R4 (T3, not yet executed): apply plan Task 3 Step 2 contingency (synthetic owner_id mismatch to
  get a genuine RED for test 1). Cost if wrong: one test-fixture value change.

Implementer agent ids (resume for fix loops): T1 = aeba339d6abae2715 ; T2 = af0a546eb286ec8a7.

===================================================================
## Session 3 (2026-08-31) — controller resume
===================================================================
- Preflight: verify-repo-context.ps1 -Path <worktree> => PASS, branch feat/federation-inter-relay-routing, HEAD 8bdbed8. Matches ledger.
- Task 2 REVIEWER dispatched (sonnet, agent ac85add28d7e3c534). Inputs: task-2-brief.md, task-2-report.md, review-daa5fee..8bdbed8.diff. Fed controller ruling R3 + $N-placeholder recount risk + migration-017 live-DB gap.
- Task 3 brief generated: <worktree>/.superpowers/sdd/2026-08-30-sigil-inter-relay-routing/task-3-brief.md (109 lines). BASE for Task 3 = 8bdbed8cb16eb82a3b7c2c5fd3c33bd6272a6896 (current HEAD). Brief already inlines the R4 contingency (owner_id mismatch -> genuine RED for test 1) in Step 2.
- Task 2 review (agent ac85add28d7e3c534): Spec ✅ compliant, Task quality APPROVED. Placeholder/param recount clean on both INSERTs; named index-shift risk clears (action_hash stays $20/idx19). Authorised test edit correct.
  - 1 Important (plan-mandated): federation-hop-persist.test.mjs:44-49 test 2 "defaults federation_hop to false" asserts nothing about federation_hop (only duplicate===false). Memory-path default has no assertion. PG path default IS covered (postgres-repository.test.mjs:29).
  - 2 Minor (plan-mandated/cosmetic): (a) test 1 real assertion sits behind `if (stored)` guard — now dead since _debugGetEnvelope always non-null; drop guard. (b) 017_federation_outbox.sql:7 comment says "Nullable with a false default" but column is NOT NULL DEFAULT FALSE.
  - Known limitation (recorded): migration 017 zero live-DB execution locally; CI live-DB matrix is its first real run (5 checks listed in review).
- Ruling R5 (T2 Important, plan-mandated): the weak test IS a real defect per rubric ("test asserts nothing"). Fix is 3 trivial one-liners in one new test file + 1 comment. Cheaper to fix now than defer. Authorising fix round 1: add memory-path default-false assertion to test 2, drop the `if (stored)` guard in test 1, correct the 017 comment. All three folded into one fix commit. — Cost if wrong: 4-line test/comment churn in files this task already owns, fully visible in diff, revertible.

### Task 2 — fix round 1 (dispatched)
FIX_BASE for re-review = 8bdbed8cb16eb82a3b7c2c5fd3c33bd6272a6896
- Prior T2 implementer af0a546eb286ec8a7 NOT resumable (ran in prior session, no transcript). Dispatched FRESH implementer instead (haiku, agent a648fcc459a7c0528) with brief + report + 3 findings. Fresh-agent id for any round-2 resume: a648fcc459a7c0528.
- Fix round 1 DONE, commit fb5aea8. 3 findings fixed (assertion guard dropped, memory-path default assertion added, 017 comment corrected). Per-file tests 27/0. npm test 668 pass / 1 fail / 67 skip — implementer calls the 1 fail a pre-existing Ollama transient (fix diff is test-file + SQL-comment only, cannot touch Ollama).
- Scoped re-review dispatched (sonnet, agent aad31583b3b20b740): FIX_BASE 8bdbed8, HEAD fb5aea8, pkg review-8bdbed8..fb5aea8.diff.
- Task 2 fix round 1/5 (3 addressed, 0 open — weak-test assertion + dead guard + 017 comment; commits 8bdbed8..fb5aea8). Re-review: all addressed, no new breakage, Ollama npm-test fail confirmed unrelated/flaky.
- Task 2: complete (commits daa5fee..fb5aea8, review clean)

### Task 3 — validateEnvelope skipSenderRegistration option
BASE for Task 3 = fb5aea82ca8a70e603cf33a3ada8f1d768585d7c (HEAD after Task 2 fix round)
- Brief: task-3-brief.md (generated session 3, plan-text extraction, base-independent). Carries full test + impl code.
- CONTROLLER RULING R4 already in force (see "Rulings (pre-execution)"): apply plan Task 3 Step 2 contingency — synthetic `registered` entry owner_id MISMATCH (usr_other@a.example) so test 1 is a genuine RED pre-impl (ROUTE_NOT_AUTHORIZED) and GREEN post-impl. Brief Step 2 already inlines this. Tests 2+3 verbatim. Verify >=1 assertion fails before Step 3. `signedBytes` IS exported from validate-envelope.mjs line 27.
- Implementer dispatched: haiku, agent a3508f16d97de5739.
- Task 3 implemented + committed 86a3212 (DONE, no concerns). 3 new tests pass, 45 regression pass, full suite 672/739 pass / 67 skipped. Files: sigil/relay/v1/validate-envelope.mjs (+11/-4), sigil/relay/v1/validate-envelope.skip-sender.test.mjs (new, 52 lines).
- Task 3 review package: review-fb5aea8..86a3212.diff (BASE fb5aea8, HEAD 86a3212, 1 commit).
- Task 3 REVIEWER dispatched: sonnet, agent a14478c98b27bddac. Security-adjacent (skips UNKNOWN_ENDPOINT/ENDPOINT_REVOKED/ROUTE_NOT_AUTHORIZED when opt set). Told to verify R4 RED was genuinely the owner-mismatch path + default path byte-equivalent.
- Task 3 review: Spec ✅ compliant, Task quality APPROVED. Named-risk check: default path byte-for-byte equivalent (ENDPOINT_REVOKED check not dropped/reordered, code strings + messages identical, new trailing INVALID_SIGNATURE unreachable on default path). R4 verified: test 1 synthetic owner_id `usr_other@a.example` vs sender `usr_chris@primary.example`; RED evidence = `code: 'ROUTE_NOT_AUTHORIZED'` / "Sender owner mismatch" (correct path), GREEN post-impl `accepted:true`. Tests 2+3 verbatim. No Critical/Important.
- Task 3: minor (deferred): validate-envelope.skip-sender.test.mjs — no test for ENDPOINT_REVOKED-skipped-under-flag nor the trailing INVALID_SIGNATURE fail-closed branch (flag set + synthetic entry omitted). Brief only required 3 cases; polish.
- Task 3: minor (deferred): validate-envelope.mjs:75 new line reuses message string "Signature key is not registered for the endpoint" (also used at the `!key?.public_key` guard); a distinct "synthetic sender entry missing" message would aid debugging.
- Task 3: complete (commits fb5aea8..86a3212, review clean)

===================================================================
## BATCH 1 COMPLETE (Tasks 1-3). Final whole-branch review next.
===================================================================
- All 3 tasks complete. Branch HEAD 86a3212. MERGE_BASE (branch start) = 7c2e867.
- Do NOT dispatch Task 4 — batch scope ends here.
- Next: final whole-branch review, MERGE_BASE 7c2e867 -> HEAD, code-reviewer.md, most capable model.
  Point it at: the 3 Task-1 deferred minors, the Task-2 migration-017 live-DB gap (CI first real run),
  the 2 Task-3 deferred minors above.
- Final whole-branch review DISPATCHED: opus, agent ac0899c5c80689d1e. Pkg review-7c2e867..86a3212.diff (4 commits). Fed all 6 deferred/known items + 3 named risks (placeholder counts, default-path equivalence, deliveries.federation_hop default sufficiency).
- Final review (opus): **Ready to merge = YES.** Ran full suite in worktree: 739 tests / 672 pass / 0 fail / 67 skip. All 3 named risks CLEAN (placeholder alignment $21-before-literal; default-path byte-identical; deliveries default sufficient — only 2 creation paths, both now explicit, delivery-state.mjs spreads federation_hop through transitions). Migration auto-discovery works (readdir+sort, 017 after 016). Outbox shape sufficient for Task 13-16 reaper (every plan-needed column present; deliberately no FK to envelopes — correct). NO Critical.
  - IMPORTANT-1 (forward-blocking plan defect, NOT a Batch-1 code defect): `001_initial.sql` FKs on `envelopes` (sender_endpoint_id->endpoints, sender_owner_id->humans, signature_key_id->endpoint_keys) + `conversations.created_by` / `conversation_members` inserts in postgres-repository.mjs:512-529 will `23503` on the first inbound federated envelope whose foreign sender is not in the receiver's tables. Task 9 calls persistAcceptedEnvelope({federation_hop:true}) for exactly such a sender. Memory-repo tests (no FKs) go green through Tasks 9-12; fails on CI live-DB at Task 14+ or prod. Fix is a schema decision (shadow-upsert foreign sender / federation_hop-aware relaxation / drop sender FKs) — cheaper while 017 unreleased.
  - IMPORTANT-2 (in-scope, cheap): `skipSenderRegistration` ships with zero in-source contract. Name misleads (still needs registered.get() to succeed for sig verify); `ENDPOINT_REVOKED` genuinely skipped — guard against passing the live registry is prose in the plan, not code. Fix: block comment stating sig verification stays mandatory + caller must pass a synthetic single-entry map built from peer-asserted key, NOT the live registry + ENDPOINT_REVOKED/owner-match are the caller's responsibility on this path.
  - Minors: (3) sigil.mjs:90 missing-<name> usage still says `--owner` required + omits `--federation-owner`; (4) sigil.mjs:41 usage() line long; (5) init-federation-owner.test.mjs test 5 no no-partial-write assert; (6) validate-envelope.mjs:76 msg string dup with :81; (7) no test for ENDPOINT_REVOKED-skipped nor line-76 fail-closed branch; (8) plan's pgcrypto "already there" claim FALSE — works anyway (CI postgres:16, gen_random_uuid core builtin since PG13); (9) 017 attempt_count lacks `CHECK (>= 0)` that deliveries.attempts has; (10) no retention path for terminal `forwarded` outbox rows (full envelope JSONB each).

===================================================================
## Final-review fix wave (Batch 1)
===================================================================
FIX_BASE for final re-review = 86a3212390ec5a9f483fe7ac4379416b14389080
- Ruling R6 (IMPORTANT-1): carry forward, do NOT fix in Batch 1. It is a forward-blocking PLAN defect, not a defect in Tasks 1-3 (which the review confirms are correct + mergeable). The fix is a schema-design decision (how a receiver persists a foreign sender under FK constraints) that belongs in Batch 2 planning before Task 4/9, not a batch-1 cleanup. Batch 2 session MUST resolve it before Task 9: either amend 017 while unreleased, or add an explicit "register/shadow-upsert foreign sender" step to Task 9 + a live-DB test proving the persist commits. — Cost if wrong: if Batch 2 forgets, Task 9-12 pass on memory-repo and CI live-DB breaks at Task 14+; recoverable via migration 018 + Task 9 persist rework (the more expensive path this ruling accepts the risk of).
- Ruling R7 (fix wave scope): dispatch ONE fix subagent for IMPORTANT-2 + minors 6, 7, 9 only — all in Task 3's files or the unreleased 017 migration, all cheap + safe, and 2+7 are the guardrails the review says to land before Task 9 consumes the option. Minors 3,4,5 deferred to Task 19 docs pass (per review rec 4). Minors 8,10 are plan-defect / backlog notes recorded here, no code change. — Cost if wrong: small doc-comment + 2 test blocks + 1 CHECK constraint, all visible in diff, revertible.
- Fix wave DISPATCHED: sonnet, agent a6a9a9308278f9a3f. Findings: IMPORTANT-2 (contract comment), minor 6 (msg string), minor 7 (2 tests), minor 9 (attempt_count CHECK).
- Fix wave DONE, commit 1fa421c (3 files +47/-2). Targeted 50/50 pass; npm test 741/674/0/67, audits PASS, live-Ollama passed this run. Implementer concern: test 7(b) fixture reshaped — revoked status on endpoint obj, active signing key in nested `keys:[]` — because brief's flat `status:'revoked'` tripped the `key.status==='revoked'` guard. Flagged to re-reviewer to verify the test genuinely exercises the ENDPOINT_REVOKED-skip path.
- Final-review scoped re-review DISPATCHED: sonnet, agent a73aa72f21699078d. FIX_BASE 86a3212, HEAD 1fa421c, pkg review-86a3212..1fa421c.diff.
- Final-review re-review: ALL 4 findings ADDRESSED, no new breakage. Fixture concern for test 7(b) VERIFIED sound — `endpoint.status` read from top-level Map value (line 88), signing key resolved separately from nested `keys:[]`; `accepted:true` genuinely depends on the flag; contrast assertion pins `ENDPOINT_REVOKED` without it.

===================================================================
## BATCH 1 FINISHED — clean. Branch stays OPEN for Batch 2.
===================================================================
Branch feat/federation-inter-relay-routing @ 1fa421c (5 commits ahead of sigil-repo main 7c2e867):
  daa5fee  Task 1  sigil init --federation-owner
  8bdbed8  Task 2  federation_hop columns + federation_outbox (migration 017)
  fb5aea8  Task 2 fix  memory-path default assertion + 017 comment
  86a3212  Task 3  validateEnvelope skipSenderRegistration option
  1fa421c  final fix wave  skipSenderRegistration contract comment + 2 tests + attempt_count CHECK
All 3 tasks: review clean. Final whole-branch review (opus): Ready to merge = YES. npm test 674 pass / 0 fail / 67 skip.
NOT pushed (feature branch, local only). Workspace + ledger RETAINED — Batch 2 needs the rulings + conflict-scan table.

### CARRY-FORWARD to Batch 2 (BLOCKER — resolve before Task 9)
Ruling R6 / final-review IMPORTANT-1: `sigil/migrations/001_initial.sql` FKs on `envelopes`
(sender_endpoint_id->endpoints, sender_owner_id->humans, signature_key_id->endpoint_keys, composite
(sender_endpoint_id,sender_owner_id)->endpoints) + `conversations.created_by` / `conversation_members`
inserts at postgres-repository.mjs:512-529 will throw 23503 on the first inbound federated envelope
(foreign sender not in receiver's endpoints/humans/endpoint_keys). Plan Task 9 calls
persistAcceptedEnvelope({federation_hop:true}) for exactly such a sender. Memory-repo tests (no FKs)
pass through Tasks 9-12; breaks on CI live-DB at Task 14+ / prod.
Batch 2 MUST, before Task 9: pick an approach (amend 017 while unreleased to relax/shadow-upsert
foreign sender rows, OR add an explicit "register foreign sender" step to Task 9) AND add a live-DB
test proving the federated persist actually commits. postgres-repository.test.mjs:101 already fakes a
23503 on INSERT INTO envelopes.

### Deferred minors (fold into Task 19 docs/cleanup pass)
- sigil/cli/sigil.mjs:90 missing-<name> usage string still names only `--owner` (implies required; it defaults) and omits `--federation-owner`. The usage() banner at :41 is correct.
- sigil/cli/sigil.mjs:41 usage() init line long, folds two parentheticals (cosmetic).
- sigil/cli/init-federation-owner.test.mjs test 5 (both flags) doesn't assert `!existsSync(.sigil/codex.identity.json)` like tests 2/3 (behavior correct today — throw precedes any write).

### Backlog notes (no code change; raise at plan close-out)
- Plan Task 2 Step 4's claim "gen_random_uuid() already in 001_initial.sql, no change needed" is FALSE — pgcrypto is not created anywhere; 017 is the first migration using it. Works anyway: CI runs postgres:16-alpine and gen_random_uuid() is a core builtin since PG13. If anyone ever targets PG<=12, add `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.
- federation_outbox has no retention path for terminal `forwarded` rows (full envelope JSONB each). Not in scope for Tasks 4-19; make it an explicit backlog item at close-out.

### Batch 2 start checklist (fresh session)
1. Preflight: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing (expect branch feat/federation-inter-relay-routing, HEAD 1fa421c).
2. Re-run superpowers:subagent-driven-development. This ledger's first line names the plan — Tasks with `Task N: complete` are DONE (1, 2, 3). Resume at Task 4.
3. Run the pre-execution conflict scan for Batch 2's task set (plan "Execution — Batch 2" section) BEFORE dispatching Task 4, same as session 2 did for Batch 1. Append the tables here.
4. Address CARRY-FORWARD R6 before Task 9.

### Rulings made (Batch 1) — for the finish list
- R1 (T1): mutual-exclusion error message must contain substring `both --owner and --federation-owner` so plan Task 1 Step 1 test 5 passes unmodified. Cost if wrong: string-wording tweak, visible in diff.
- R2 (T1): plan defect — brief's tests used `--domain a.example` (RFC 2606, never DNS-resolves) but cmdInit runs resolveDomainOrThrow first. Swapped to `--domain local` + `@local` id assertions in the new test file only; kept cross-domain owner usr_chris@primary.example. Cost if wrong: test-only domain-literal churn in one new file.
- R3 (T2): authorized `20`->`21` + added assertion at postgres-repository.test.mjs:28, folded into Task 2's commit. Stale hardcoded count is a direct consequence of Task 2's required schema change. Cost if wrong: one-token test edit in the same commit.
- R4 (T3): applied plan Task 3 Step 2 contingency — synthetic `registered` entry owner_id mismatch (usr_other@a.example) so test 1 is a genuine RED (ROUTE_NOT_AUTHORIZED) pre-impl. Cost if wrong: one test-fixture value change.
- R5 (T2 fix round 1): the plan-mandated weak test (test 2 asserting nothing about federation_hop) IS a real rubric defect; authorized a 1-round fix folding the Important + 2 minors (assertion guard drop, memory-path default assertion, 017 comment) into one commit fb5aea8. Cost if wrong: 4-line test/comment churn in files the task already owns.
- R6 (Batch 2 carry-forward): final-review IMPORTANT-1 (envelopes sender FKs block Task 9 federated persist on Postgres) is a forward-blocking PLAN defect, not a Batch-1 code defect. Ruled NOT to fix in Batch 1 (schema-design decision belongs in Batch 2 planning). Cost if wrong: Batch 2 forgets -> Tasks 9-12 green on memory-repo, CI live-DB breaks at Task 14+; recoverable via migration 018 + Task 9 persist rework.
- R7 (final fix wave scope): dispatched ONE fix subagent for IMPORTANT-2 + minors 6/7/9 only (all Task 3 files or unreleased 017, cheap+safe; 2+7 are the guardrails to land before Task 9 uses the option). Minors 3/4/5 -> Task 19. Minors 8/10 -> backlog notes. Cost if wrong: doc comment + 2 test blocks + 1 CHECK constraint, all visible in diff, revertible.

===================================================================
## Session 4 (2026-08-31) — Batch 2 (Tasks 4-7, all federation-router.mjs)
===================================================================
- Preflight: verify-repo-context.ps1 -Path <worktree> => PREFLIGHT_PASS, branch feat/federation-inter-relay-routing, HEAD 1fa421c304f498dd7173e1aaeb3dd10a42962745. Matches Batch 1 finish line.
- Batch scope: Tasks 4-7 ONLY (plan line 1934). All four touch the SAME new pair: sigil/relay/v1/federation-router.mjs + sigil/relay/v1/federation-router.test.mjs. T4 creates; T5/T6/T7 append.
- Batch-end whole-branch review: SKIPPED for Batch 2 per plan line 1933 ("No batch-end final whole-branch review — that runs only after the last batch (Task 19)"). Batch 1's retained "RESUME HERE" step 6 said otherwise; plan text is the authority. Per-task reviews only; branch stays open for Batch 3.
- R6 (envelopes FK blocker): NOT in Batch 2's blast radius — Tasks 4-7 do not touch 001_initial.sql, migrations/, or postgres-repository persist. R6 stays carried to Batch 3 (resolve before Task 9).

### Preflight conflict scan (RAN 2026-08-31, session 4)

#### Consumed-interface existence check (all confirmed present at HEAD 1fa421c)
| Symbol | Source | Line | Used by |
|---|---|---|---|
| parseFederatedId | sigil/relay/v1/federated-id.mjs | 43 | T4 |
| parseDomain | sigil/relay/v1/federated-id.mjs | 5 | T4 (via parseFederatedId) |
| checkRecipientLocality | sigil/relay/v1/validate-envelope.mjs | 49 | T4 |
| reject | sigil/relay/v1/validate-envelope.mjs | 33 | T4 (returns Error; used as `throw reject(...)` in source) |
| canonicalJsonBytes | sigil/relay/v1/jcs.mjs | 26 | T5, T7 |
| getPeerByDomain | memory-repository.mjs:313 + postgres-repository.mjs:963 | - | T4 (injected as callback) |
| federation-router.mjs / .test.mjs | - | - | ABSENT (T4 creates) — confirmed |

#### Cross-task table (Batch 2 = Tasks 4-7)
| Pair | Shared file / interface | Producer -> Consumer | Finding |
|---|---|---|---|
| T4 x T5 | federation-router.mjs + .test.mjs | T4 creates module + test file; T5 appends buildForwardRequest/signForwardRequest + tests | sequential append; no symbol clash | CLEAN |
| T4 x T6 | same pair | T6 appends postForward + tests | CLEAN |
| T4 x T7 | same pair | T7 appends verifyRelaySignature + tests | CLEAN (impl side); test-file dup import — see self-consistency T7 |
| T5 x T6 | same pair | disjoint functions (build/sign vs postForward) | CLEAN |
| T5 x T7 | .test.mjs | both import `canonicalJsonBytes` from ./jcs.mjs | CONFLICT — T7 Step 1 re-adds an import T5 Step 1 already appended; duplicate named import = SyntaxError. Ruling R9. |
| T6 x T7 | same pair | disjoint functions | CLEAN |
| batch -> later | decideRoute/buildForwardRequest/signForwardRequest/postForward/verifyRelaySignature | consumed by Tasks 8/10/11/15 | no intra-batch dep beyond append order; nothing in 4-7 consumes another's runtime output | CLEAN |

#### Self-consistency table
| Task | Own text checked | Finding |
|---|---|---|
| T4 | 7 brief tests vs impl branches (no-relayDomain/local, mode-unset/delegate, local-domain/local, foreign-unpinned/PEER_NOT_PINNED, foreign-pinned/forward, malformed/MALFORMED_FEDERATED_ID, storedFederationHop/FEDERATION_HOP_EXCEEDED) | OK — every test maps to an impl branch; `checkRecipientLocality(envelope, undefined)` early-returns so no-relayDomain yields {action:'local'} |
| T4 | interface bullet "storedFederationHop===true -> {action:'reject',code:'FEDERATION_HOP_EXCEEDED'}" (no details) vs impl adds `details:{recipientDomain}` vs type-consistency section line 1975 (wants details.recipientDomain) | OK — impl is the superset the consumers (Tasks 11/15) read; bullet is shorthand. No ruling. |
| T5 | Step 1 appends `import crypto`, `import {buildForwardRequest,signForwardRequest}`, `import {canonicalJsonBytes} from './jcs.mjs'` — all first occurrence in the file | OK |
| T5 | Step 3 appends mid-file imports then instructs "move to top of file" | OK — explicit instruction |
| T6 | Step 3 impl `new URL('/v1/federation/envelopes', peer.relayUrl)` with test fixture `peer.relayUrl='https://b.example/relay'` yields `https://b.example/v1/federation/envelopes` (leading-slash path ref drops base path). Step 1 test asserts `String(seenUrl)==='https://b.example/relay/v1/federation/envelopes'`. Spec line 166: `POST {peer.relayUrl}/v1/federation/envelopes` (concat). peer-discovery.mjs:63 sets relayUrl from `data.relay.endpoint` (may carry a path). | CONFLICT — impl URL construction contradicts the task's own test AND the spec's concat semantics. Ruling R8. |
| T7 | Step 1 appends `import {canonicalJsonBytes} from './jcs.mjs'` — already appended by T5 Step 1 | CONFLICT — duplicate named import = `SyntaxError: Identifier 'canonicalJsonBytes' has already been declared`. Ruling R9. |
| T7 | Step 3 impl uses `crypto` + `canonicalJsonBytes` — already at top of federation-router.mjs from T5 Step 3 "move to top" | OK — impl side clean |
| T7 | `keyEntry` helper uses `KeyObject.export({type:'spki',format:'der'})` on `crypto.generateKeyPairSync('ed25519')` output | OK |

### Rulings (pre-execution, Batch 2)
- R8 (T6): implementer MUST build the forward URL by path-append that preserves any base path in `peer.relayUrl` — `peer.relayUrl.replace(/\/+$/, '') + '/v1/federation/envelopes'` — NOT `new URL('/v1/federation/envelopes', peer.relayUrl)`. A leading-slash path reference in `new URL` discards the base URL's path, so plan Step 3 as written fails the task's own Step 1 2xx test (`https://b.example/relay/v1/federation/envelopes`) whenever a pinned peer's relayUrl carries a path. String concat matches spec line 166 `POST {peer.relayUrl}/v1/federation/envelopes` exactly. — Cost if wrong: one-line URL-construction change in a new file, fully visible in diff, pinned by the Step 1 test's exact-string assertion.
- R9 (T7): implementer MUST NOT re-add `import { canonicalJsonBytes } from './jcs.mjs';` in Task 7 Step 1 — Task 5 Step 1 already appended it to federation-router.test.mjs; a second identical named import in one ES module is a parse-time SyntaxError. Append only `import { verifyRelaySignature } from './federation-router.mjs';` and the new tests. — Cost if wrong: test file fails to parse, caught instantly by Step 2's test run, one-line delete to fix.

## Progress (Batch 2)
BASE for Task 4 = 1fa421c304f498dd7173e1aaeb3dd10a42962745

### Task 4 — federation-router.mjs decideRoute
- Implementer (haiku, agent ac5feb55ff28d7a94): DONE, commit 1bab66d. Test + impl copied verbatim from brief. RED (ERR_MODULE_NOT_FOUND) -> GREEN 7/7 focused; npm test 748/681 pass / 0 fail / 67 skip.
- Review package: review-1fa421c..1bab66d.diff (BASE 1fa421c, HEAD 1bab66d, 1 commit).
- Task 4 REVIEWER (sonnet, agent ade31cd4c2bd8d3e1): Spec PASS (all 8 branch constraints + type-consistency + TDD verified at federation-router.mjs:24-58; controller `details` ruling honored). Task quality APPROVED. No Critical/Important. 3 Minor, all plan-authored (verbatim from brief), none enter the loop.
- Task 4: minor (deferred, carry to whole-branch review): federation-router.mjs:53 `getPeerByDomain(recipientId.domain)` passes raw-case domain while the local-domain check at :41 lowercases both sides; `parseFederatedId` does not normalize case. `ep_x@B.EXAMPLE` vs peer pinned `b.example` -> wrong PEER_NOT_PINNED, and a `forward` result carries a mixed-case `recipientDomain`. Verbatim from brief Step 3. Whole-branch review (Task 19) must confirm domain-case normalization happens upstream before decideRoute, or add a `.toLowerCase()` on the peer lookup + forward domain.
- Task 4: minor (deferred): federation-router.test.mjs has no test for the `!envelope?.recipient` broadcast branch (impl has it at :25; brief's mandated test set omitted it).
- Task 4: minor (noted, no action): task-4-report.md "Files Changed" table line counts (44/59) disagree with actual diff (41/35); report-only, code unaffected.
- Task 4: complete (commits 1fa421c..1bab66d, review clean)

### Task 5 — buildForwardRequest + signForwardRequest
BASE for Task 5 = 1bab66df38fb4c49c8512bc988adfcd2d71e9ad1
- Implementer (haiku, agent ae68c99cfeb0465be): DONE, commit 566e37b. Verbatim from brief. RED (SyntaxError: no export 'buildForwardRequest') -> GREEN 9/9 focused (7 Task 4 + 2 new); npm test 750/683 pass / 0 fail / 67 skip. Imports moved to top, no mid-file imports in impl, no dup test imports, decideRoute untouched.
- Review package: review-1bab66d..566e37b.diff (BASE 1bab66d, HEAD 566e37b, 1 commit, 58 insertions / 0 deletions).
- Task 5 REVIEWER (sonnet, agent a0ff1f5c400651211): Spec COMPLIANT (decideRoute + 7 tests untouched confirmed; no mid-file imports in module; no dup test imports; postForward/verifyRelaySignature absent; body-never-re-serialized property structurally holds — signForwardRequest signs passed-in bytes, never touches body). Task quality APPROVED. No Critical/Important. 4 Minor (coverage nits + brief-sanctioned mid-file test imports), none enter the loop.
- Task 5: minor (deferred): no test for `sender_key.alg` default (`?? 'Ed25519'` branch unexercised — both tests pass alg explicitly).
- Task 5: minor (deferred): no test for `now` passed as a string (only `now instanceof Date` path covered).
- Task 5: minor (noted): test-file new imports sit mid-file (brief Step 1 instructs it; ESM-hoisted, functionally fine); federation-router.mjs:43 buildForwardRequest has no guard on undefined `senderKey` (matches brief reference, internal fn).
- Task 5: complete (commits 1bab66d..566e37b, review clean)

### Task 6 — postForward
BASE for Task 6 = 566e37b7785e27a67be097afa1166a05c671d111
- Implementer (haiku, agent aed6fefed043dcb32): DONE, commit 1435405. Verbatim from brief EXCEPT R8 URL line applied (`peer.relayUrl.replace(/\/+$/, '') + '/v1/federation/envelopes'`, federation-router.mjs:32). RED (SyntaxError: no export 'postForward') -> GREEN 16/16 focused (9 prior + 7 new); npm test 757/690 pass / 0 fail / 67 skip.
- Review package: review-566e37b..1435405.diff (BASE 566e37b, HEAD 1435405, 1 commit, +38 mjs / +57 test).
- Task 6 REVIEWER (sonnet, agent a0fd2934c669ca293): Spec COMPLIANT. R8 path-preserving URL PRESENT + satisfies Step 1 assertion (brief's defective `new URL(...)` NOT used). Prior 3 fns + 9 tests untouched (no deletions/mods). verifyRelaySignature absent. No new imports. 4 KiB cap + `PEER_CODE_RE` gate implemented not just claimed (mjs:28-29,58,60). Raw peer body never returned/logged (only regex-validated `parsed.code`; throws use status not body). 5xx + transport/timeout both throw FORWARD_TRANSPORT_FAILED. Task quality APPROVED. No Critical/Important. All Minor -> none enter the loop.
- Task 6: minor (deferred, plan-mandated, carry to whole-branch review): federation-router.mjs:57-58 `await res.text()` buffers the ENTIRE peer error body into memory before the `text.length <= PEER_BODY_READ_CAP` check — the 4 KiB "cap" bounds parsing, not the read. Verbatim from brief Step 3. Low risk (peers are signature-authenticated); a true bound needs streaming `res.body` with abort past 4 KiB.
- Task 6: minor (noted, all brief-verbatim / edge-only): inconsistent thrown-error shape (transport throw `{code,cause}` vs 5xx `{code,status}`); a non-Response return from `fetchImpl` throws a raw TypeError outside the catch (real `fetch` always resolves a Response); test-file `import { postForward }` mid-file (brief Step 1, ESM-hoisted); no test asserts method/body/signal/content-type or a 4xx JSON body lacking `code`.
- Task 6: complete (commits 566e37b..1435405, review clean)

### Task 7 — verifyRelaySignature
BASE for Task 7 = 1435405ab902ba2a1261ce328199810aa7fd7180
- Implementer (haiku, agent ae09e78f441211734): DONE, commit aa8fe98. Verbatim from brief EXCEPT R9 — omitted the duplicate `import { canonicalJsonBytes } from './jcs.mjs'` (already at test.mjs:39 from Task 5). RED (SyntaxError: no export 'verifyRelaySignature') -> GREEN 21/21 focused (16 prior + 5 new); npm test 67 skip normal.
- Review package: review-1435405..aa8fe98.diff (BASE 1435405, HEAD aa8fe98, 1 commit, +11 mjs / +36 test).
- Task 7 REVIEWER (sonnet, agent a5a8b8ef410097ef4): Spec COMPLIANT. R9 verified — exactly ONE `canonicalJsonBytes` import in test.mjs (line 39); diff adds only the `verifyRelaySignature` import. Prior 4 fns + 16 tests untouched. No new module imports. Fail-closed real: single try/catch (mjs:94-101) wraps all work; missing-arg / missing peer.keys / malformed DER / missing signature all land in catch -> false; no path returns true without a real `crypto.verify` pass. Re-canonicalization structurally enforced (object in, not bytes). 5 tests use real Ed25519 keypairs + real SPKI DER, no mocks. Task quality APPROVED (security-load-bearing fn reviewed as such). No Critical/Important. Minor only -> none enter the loop.
- Task 7: minor (deferred): no explicit test for garbage-base64url publicKey forcing `createPublicKey` to throw (swapped-key test uses a valid wrong key), nor missing `peer` / missing `signature` arg — all handled by code, none mandated by brief (5 tests exactly). Harden `catch`-path regression coverage in Task 19.
- Task 7: minor (noted): test-file `import { verifyRelaySignature }` sits mid-file (brief Step 1, ESM-hoisted, matches Task 5 pattern).
- Task 7: complete (commits 1435405..aa8fe98, review clean)

===================================================================
## BATCH 2 FINISHED — clean. Branch stays OPEN for Batch 3.
===================================================================
Branch feat/federation-inter-relay-routing @ aa8fe98 (9 commits ahead of sigil-repo main 7c2e867; 4 new this batch):
  1bab66d  Task 4  federation-router decideRoute
  566e37b  Task 5  buildForwardRequest + signForwardRequest
  1435405  Task 6  postForward (bounded peer-code parsing; R8 URL fix)
  aa8fe98  Task 7  verifyRelaySignature (canonicalize-after-parse, fail closed; R9 import fix)
All 4 tasks: review clean (no Critical/Important in any task review). No fix loops needed.
sigil/relay/v1/federation-router.test.mjs: 21/21 pass. npm test full-suite green each task (67 skip = no live DB/Ollama locally).
NO batch-end whole-branch review (plan line 1933 — that runs only after Task 19). PUSHED 2026-08-31 to origin/feat/federation-inter-relay-routing (upstream set; pre-push gate green: 762 tests / 695 pass / 0 fail / 67 skip, live-Ollama + JCS + dep audits PASS). Workspace + ledger RETAINED for Batches 3-6.

### CARRY-FORWARD to Batch 3 (unchanged — R6 still the blocker)
Ruling R6 / final-review IMPORTANT-1 from Batch 1: `sigil/migrations/001_initial.sql` FKs on `envelopes` (sender_endpoint_id->endpoints, sender_owner_id->humans, signature_key_id->endpoint_keys) + `conversations`/`conversation_members` inserts at postgres-repository.mjs:512-529 throw 23503 on the first inbound federated envelope (foreign sender absent from receiver tables). Batch 3 = Tasks 8-10 (receiver). Task 9 calls `persistAcceptedEnvelope({federation_hop:true})` for exactly such a sender. Batch 3 MUST, before Task 9: amend migration 017 while unreleased to relax/shadow-upsert the foreign sender OR add an explicit "register foreign sender" step to Task 9, PLUS a live-DB test proving the federated persist commits. postgres-repository.test.mjs:101 already fakes a 23503 on INSERT INTO envelopes.

### Deferred minors from Batch 2 (fold into Task 19 docs/cleanup pass)
- federation-router.mjs:53 (T4): `getPeerByDomain(recipientId.domain)` passes raw-case domain while the local-domain check at :41 lowercases; `parseFederatedId` does not normalize case. `ep_x@B.EXAMPLE` vs peer pinned `b.example` -> wrong PEER_NOT_PINNED; a `forward` result carries a mixed-case `recipientDomain`. Verbatim from brief. Task 19 (or whole-branch review): confirm upstream domain-case normalization before decideRoute, else add `.toLowerCase()` on the peer lookup + forward domain.
- federation-router.mjs:57-58 (T6): `await res.text()` buffers the ENTIRE peer error body before the 4 KiB length check — the cap bounds parsing, not the read. Verbatim from brief. Low risk (peers signature-authenticated). True bound needs streaming `res.body` + abort past 4 KiB.
- Test coverage nits (T5/T6/T7): no test for `sender_key.alg` default; `now` as a string; POST method/body/signal/content-type headers on postForward; 4xx JSON body lacking `code`; garbage-base64url publicKey / missing peer / missing signature fail-closed branches in verifyRelaySignature. All brief-verbatim test sets. Add to the Task 19 regression sweep.
- Mid-file `import` statements in federation-router.test.mjs (T5/T6/T7 each append their imports after prior test blocks). ESM-hoisted, harmless; a tidy-up could group them at top if any later task rewrites the file header.

### Rulings made (Batch 2) — for the finish list
- R8 (T6): forward-URL construction — implementer MUST use `peer.relayUrl.replace(/\/+$/, '') + '/v1/federation/envelopes'` (path-preserving concat, matches spec line 166 and the task's own Step 1 test), NOT the brief Step 3 `new URL('/v1/federation/envelopes', peer.relayUrl)` (leading-slash path ref drops any base path in relayUrl; peer-discovery.mjs:63 sets relayUrl from `data.relay.endpoint` which may carry one). Cost if wrong: one-line URL-construction change in a new file, pinned by the Step 1 exact-string assertion, fully visible in diff.
- R9 (T7): implementer MUST NOT re-add `import { canonicalJsonBytes } from './jcs.mjs';` in Task 7 Step 1 — Task 5 Step 1 already appended it to federation-router.test.mjs; a duplicate named import is a parse-time SyntaxError. Appended only the `verifyRelaySignature` import + the 5 new tests. Cost if wrong: test file fails to parse, caught instantly by the Step 2 run, one-line delete to fix.

### Batch 3 start checklist (fresh session)
1. Preflight: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing (expect branch feat/federation-inter-relay-routing, HEAD aa8fe98).
2. Re-run superpowers:subagent-driven-development. Tasks with `Task N: complete` are DONE (1-7). Resume at Task 8.
3. Run the pre-execution conflict scan for Batch 3's task set (Tasks 8-10, receiver: acceptFederatedEnvelope + POST /v1/federation/envelopes route). Append the tables here. STILL PENDING — not yet run.
4. R6 RESOLVED — see Ruling R10 below. Carry R10 into the Task 9 dispatch brief. Still owed: the live-DB test.

===================================================================
## Session 5 (2026-08-31) — controller resume, R6 decision, then HANDOFF
===================================================================
- Preflight: verify-repo-context.ps1 -Path <worktree> => PREFLIGHT_PASS, branch feat/federation-inter-relay-routing. Matches Batch 2 finish line (HEAD aa8fe98).
- No implementer dispatched this session. Batch 3 execution NOT started. Conflict scan (checklist step 3) NOT run.
- Session hit 4.8h continuous at this point → handed off here per CLAUDE.md session-length rule. Resume point = this ledger; next action = Batch 3 checklist step 3 (conflict scan), then dispatch Task 8.

### Ruling R10 (R6 resolution — user-approved 2026-08-31, AskUserQuestion)
Approach chosen for the foreign-federated-sender vs FK chain blocker: **shadow-upsert via a new repository method** (NOT FK relaxation, NOT deferral).

FK chain confirmed against sigil/migrations/001_initial.sql:
- humans(human_id) PK; endpoints.owner_id → humans; endpoint_keys.endpoint_id → endpoints;
  conversations.created_by → humans; conversation_members.endpoint_id → endpoints, .added_by → humans;
  envelopes.sender_endpoint_id → endpoints, .sender_owner_id → humans, .signature_key_id → endpoint_keys,
  composite (sender_endpoint_id, sender_owner_id) → endpoints(endpoint_id, owner_id).
- postgres-repository.mjs #insertAcceptedEnvelope (lines 512-556): first insert (conversations, created_by = sender.owner_id) already throws 23503 for a foreign sender; then conversation_members, then envelopes.
- Memory-repository has no FKs → Tasks 9-12 pass there; CI live-DB / prod breaks at Task 14+.

R10 scope for the Batch 3 controller to implement (fold into Task 9, extend Task 9 brief):
1. Add `PostgresRepository.registerFederatedSender({ endpoint_id, owner_id, key_id, public_key, origin_domain }, client)` —
   `INSERT ... ON CONFLICT DO NOTHING` into humans, endpoints, endpoint_keys. Placeholder values for
   endpoints NOT-NULL cols with no default: runtime='federated', installation_id=origin_domain,
   display_name=endpoint_id, status='active'. humans: status='active', created_at=now. endpoint_keys:
   algorithm='Ed25519', public_key=<peer-asserted DER bytes>, status='active', valid_from=now.
2. Add the matching `MemoryRepository.registerFederatedSender(...)` — insert into the registry Map
   (mirrors how the plan's worldWithRecipient test seeds recipients); no-op if already present.
3. Task 9 Step 4: call `await repository.registerFederatedSender({...}, client)` INSIDE the
   `repository.withTransaction` block, BEFORE `persistAcceptedEnvelope(...)`. Source values from the
   relay-attested `senderOwnerId`, `envelope.sender.endpoint_id`, `envelope.signature.key_id`, the
   peer-asserted `senderKey.publicKey` (base64url → DER Buffer), and `originDomain`.
4. Amend migration 017 (still unreleased) to add `ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS origin_domain TEXT;`
   so shadow rows are identifiable + sweepable. registerFederatedSender sets it; local registrations leave it NULL.
   NOTE: this adds a 3rd ALTER to 017 → recount any hardcoded column-count / $N-placeholder assertions in
   postgres-repository.test.mjs the same way Ruling R3 handled the federation_hop param.
5. New live-DB test (checklist item still owed): prove the federated persist actually COMMITS on Postgres —
   POST a federated envelope whose sender is absent from endpoints/humans/endpoint_keys, assert the
   envelopes row exists afterward and endpoints.origin_domain = the origin domain. Gate it on
   SIGIL_TEST_DATABASE_URL like the other live-DB suites (postgres-repository.test.mjs:101 already fakes a
   23503 on INSERT INTO envelopes — model the new test near it).
Cost if wrong: shadow rows are real rows in the receiver's identity tables carrying placeholder
runtime/installation_id/display_name. If the chosen placeholders or the origin_domain marker turn out wrong,
the fix is a follow-up migration to correct column values + a one-line change in registerFederatedSender —
bounded, visible in diff. Referential integrity is preserved throughout (the deferral and FK-drop options
both traded that away). The alternative if R10 itself is misjudged: migration 018 + Task 9 persist rework,
same recovery path R6 originally accepted.

===================================================================
## Session 6 (2026-08-31) — Batch 3 (Tasks 8-10, receiver)
===================================================================
- Preflight: verify-repo-context.ps1 -Path <worktree> => PREFLIGHT_PASS, branch feat/federation-inter-relay-routing, HEAD aa8fe981d3498811f07bd574f68ab0c055547067. Matches Batch 2 finish line.
- Batch scope: Tasks 8-10 ONLY (plan line 1934). No batch-end whole-branch review (plan line 1933 — only after Task 19). Per-task reviews only; branch stays open for Batch 4.
- R10 (R6 resolution, user-approved) folded into the Task 9 dispatch brief — see "Task 9 dispatch: R10 addendum" below.

### Preflight conflict scan (RAN 2026-08-31, session 6) — Batch 3 = Tasks 8-10

#### Consumed-interface existence check (all at HEAD aa8fe98 unless noted)
| Symbol | Source | Line | Used by | Status |
|---|---|---|---|---|
| parseDomain, parseFederatedId | sigil/relay/v1/federated-id.mjs | 5, 43 | T8 | PRESENT |
| verifyRelaySignature | sigil/relay/v1/federation-router.mjs | 100 | T8 | PRESENT (Task 7) |
| buildForwardRequest, signForwardRequest | sigil/relay/v1/federation-router.mjs | 45, 56 | T8/T10 tests | PRESENT (Task 5) |
| signedBytes, reject, validateEnvelope | sigil/relay/v1/validate-envelope.mjs | 27, 33, 62 | T8/T9 | PRESENT |
| validateEnvelope `skipSenderRegistration` opt | sigil/relay/v1/validate-envelope.mjs | 62 (param), 72-86 (contract) | T9 | PRESENT (Task 3 + Batch-1 final fix) |
| resolveRateLimits, DEFAULT_INBOX_DEPTH_LIMIT | sigil/relay/v1/relay-config.mjs | 22, 6 | T9 | PRESENT |
| repo.getPeerByDomain / upsertPeer | memory-repository.mjs | 313 / 301 | T8/T9 tests | PRESENT |
| repo.lookupIdempotency / lookupAcceptedMessageId / reserveRateLimit / countOpenDeliveries / persistAcceptedEnvelope / recordAuditEvent / withTransaction / listInbox / _debugGetEnvelope / _debugGetAuditEvents | memory-repository.mjs | 50 / 61 / 40 / 46 / 73 / 331 / 39 / 91 / 343 / 340 | T9 | PRESENT |
| repo.lookupRecipientEndpoint | memory-repository.mjs:69 (returns raw registry entry, active-filtered) ; postgres-repository.mjs:56 (SELECT endpoint_id, owner_id — NO status field, active-filtered in SQL) | - | T9 | PRESENT — but shape mismatch, see self-consistency T9 / Ruling R11 |
| createRelayServer, readBody | sigil/relay/v1/http-server.mjs | 32, 26 | T10 | PRESENT |
| /v1/health block ; authenticateRequest gate | sigil/relay/v1/http-server.mjs | 146 ; 151-152 | T10 anchor | PRESENT (plan says "line 149"/"line 151" — ~3-line drift, ordering intact) |
| accept-federated-envelope.mjs / .test.mjs | - | - | T8 creates | ABSENT — confirmed |
| http-server.federation-inbound.test.mjs | - | - | T10 creates | ABSENT — confirmed |
| PostgresRepository.registerFederatedSender / MemoryRepository.registerFederatedSender | - | - | T9 (R10) | ABSENT — T9 creates both (R10 pt 1-2) |

#### Cross-task table (Batch 3 = Tasks 8-10)
| Pair | Shared file / interface | Producer -> Consumer | Finding |
|---|---|---|---|
| T8 x T9 | accept-federated-envelope.mjs + .test.mjs | T8 creates module (checks 1-5 + `ACCEPTED_STUB` return) + test file; T9 replaces the stub `return` with checks 6-10 transaction body, appends imports + 7 tests | sequential, T9 explicitly extends T8's file. T9 brief MUST carry T8's final in-source shape (the exact stub line to replace, the checks-1-5 var names `originDomain`/`envelope`/`senderKey`/`senderOwnerId`/`peer` it reuses). | CLEAN (append/replace, no symbol clash) |
| T8 x T10 | acceptFederatedEnvelope import | T8 exports the fn; T10 imports + calls it from the new HTTP route | T10 dispatched AFTER T9, so it sees the full 10-check handler | CLEAN |
| T9 x T10 | `options.onPersisted` callback | T9 impl calls `if (options.onPersisted) await options.onPersisted({envelope, persisted})` (plan line 1317); T10 route passes `onPersisted` that calls `stream.notify(recipient.endpoint_id, message_id)` unless `persisted.duplicate` (plan line 1400-1403) | interface shape matches on both sides (`{envelope, persisted}` in; `persisted.duplicate` + `persisted.message_id` read) | CLEAN |
| batch -> later | acceptFederatedEnvelope ; federation_hop persist ; registerFederatedSender ; createRelayServer `federationMode`/`federationIdentity`/`fetchImpl` opts | acceptFederatedEnvelope consumed by nothing else in-plan (Tasks 11-12 are origin-side, accept-envelope.mjs); federation_hop persist read by Task 15 reaper; registerFederatedSender consumed only by T9 itself; the new createRelayServer opts consumed by Tasks 11-12 (additive, no Batch-3 consumer) | no intra-batch dep beyond T8->T9->T10 order; nothing in 8-10 consumes another's runtime output | CLEAN |

#### Self-consistency table
| Task | Own text checked | Finding |
|---|---|---|
| T8 | 7 brief tests vs impl branches (check1 structural x2 / check2 PEER_NOT_TRUSTED / check3 RELAY_SIGNATURE_INVALID / check4 SENDER_DOMAIN_FOREIGN / check5 INVALID_SIGNATURE / checks-1-5-pass reaches stub) | OK — every test maps to an impl early-return; `respond()` reads `options.request_id` which `baseOpts` sets. |
| T8 | test imports `canonicalJsonBytes` from './jcs.mjs' but never references it (payloads built via `buildForwardRequest`) | Minor (cosmetic) — unused import. Verbatim from brief. Not a blocker; note for Task 19 sweep. |
| T8 | `check 1: malformed sender_owner_id` test calls `forwardPayload(...,{ senderOwnerId: 'no-domain' })` -> `buildForwardRequest` embeds it, then impl `parseFederatedId('no-domain')` throws -> 400 | OK provided `buildForwardRequest` does not itself validate `senderOwnerId` (Batch-2 ledger: "no guard on undefined senderKey", internal fn — just embeds fields). Impl-time verify note. |
| T9 | impl `const recipient = (await repository.lookupRecipientEndpoint(recipientId, client)) ?? registered?.get(recipientId); if (!recipient \|\| recipient.status !== 'active') throw RECIPIENT_NOT_FOUND` (plan line 1288-1291) vs actual repo shapes: memory:71 returns the raw registry entry (carries `status:'active'`) -> passes; postgres:56-68 `SELECT e.endpoint_id, e.owner_id` (NO `status` column; SQL already filters `status='active'`) -> returned row has `recipient.status === undefined` -> `undefined !== 'active'` truthy -> **throws RECIPIENT_NOT_FOUND for a valid active recipient on Postgres** | CONFLICT — memory-only tests (all Task 9 tests) stay green; PG live-DB path breaks. Same failure class as R6/R10 (memory coverage hides a PG bug). Ruling R11. |
| T9 | impl references `options.rateLimits` / `options.inboxDepthLimit`; T10's route call passes neither | OK — `resolveRateLimits(undefined)` -> defaults; `?? DEFAULT_INBOX_DEPTH_LIMIT`. Intentional. |
| T9 | `repository.reserveRateLimit(scopeKind, scopeId, windowStart, limit, client)` (5 args) vs memory sig `(scopeKind, scopeId, windowStart, limit)` (4, ignores client) | OK — trailing arg ignored on memory; PG method takes client. |
| T9 | Step 3 "confirm memory `lookupRecipientEndpoint` returns owner_id; extend if not" | OK — memory:69-72 passes through the raw registry entry which carries `owner_id` in the plan's `worldWithRecipient` fixture; PG:59 SELECTs `e.owner_id`. No extension needed. |
| T9 | test `same-owner exemption` asserts `world.repo._debugGetEnvelope(inbox[0].message_id).federation_hop === true` | OK — memory `persistAcceptedEnvelope` (73-89) stores `federation_hop: row.federation_hop === true`; impl passes `federation_hop: true`; `_debugGetEnvelope` (343) returns the stored row. |
| T9 (R10) | R10 pt4 adds `ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS origin_domain TEXT;` to migration 017; R10 warns "recount hardcoded column-count / $N assertions in postgres-repository.test.mjs" | LOW RISK — the only hardcoded count assertion (`postgres-repository.test.mjs:28 values.length === 21`) is on the **`INSERT INTO envelopes`** param list; the ALTER is on `endpoints`, a different table. `registerFederatedSender`'s new `endpoints` INSERT has no pre-existing test asserting its param count. Recount still required by the impl on any INSERT it writes, but no existing assertion is stale from this ALTER. |
| T9 (R10) | R10 pt1 `registerFederatedSender` placeholder values for `endpoints` NOT-NULL cols: runtime='federated', installation_id=origin_domain, display_name=endpoint_id, status='active' | Impl-time verify note — implementer MUST read `001_initial.sql`'s `endpoints` / `humans` / `endpoint_keys` CREATE TABLE and cover EVERY NOT-NULL column with no default. R10's list may be incomplete. |
| T9 (R10) | R10 pt5 live-DB test gated on `SIGIL_TEST_DATABASE_URL` | Will NOT run locally (67 live-DB suites skipped — no local Postgres). CI live-DB matrix is its first real run. Same known-gap posture as Batch-1 migration 017. This test is ALSO the pin for R11 (only path that exercises the PG recipient shape). |
| T10 | plan "immediately after the /v1/health block (line 149)" / "before the authenticateRequest gate at line 151" vs actual /v1/health@146, gate@151-152 | OK — ~3-line drift; the ordering constraint (route sits after health, before auth gate, unauthenticated) is intact. |
| T10 | plan interface bullet lists `now` as "already in scope in createRelayServer" vs actual destructure `now: configuredNow = () => new Date()` (http-server.mjs:32) | Impl-time verify note — the request handler almost certainly binds `const now = configuredNow()` locally; implementer confirms the in-scope name before using it in the `acceptFederatedEnvelope` options object. Not a blocker. |
| T10 | Step 3 adds `federationMode`, `federationIdentity`, `fetchImpl` to `createRelayServer` destructure "used by Tasks 11-12" | OK — additive, no Batch-3 consumer, no clash with existing opts. |

### Rulings (pre-execution, Batch 3)
- R11 (T9): the recipient-active guard in plan Task 9 Step 4 (`recipient.status !== 'active'`) is a self-consistency defect on the Postgres path — `PostgresRepository.lookupRecipientEndpoint` returns `{endpoint_id, owner_id}` with **no `status` field** (its SQL already filters `status='active'`), so `recipient.status` is `undefined` and the guard throws `RECIPIENT_NOT_FOUND` for every valid active federated recipient on live Postgres; memory-repo tests stay green because the memory method returns the raw registry entry which carries `status`. Implementer MUST weaken the guard to reject only on an **explicit** non-active status, e.g. `if (!recipient || (recipient.status !== undefined && recipient.status !== 'active'))` (or equivalent: treat a row returned by `lookupRecipientEndpoint` as already active, since BOTH repo methods active-filter; keep the `status` check only for the `registered?.get(recipientId)` fallback which does carry `status`). Spec intent ("recipient exists and is active in the receiver's registry") is satisfied either way — both repos enforce active-only before returning. — Cost if wrong: one-line predicate change in a new file, fully visible in diff; pinned by R10 pt5's live-DB test (the only path that returns the status-less PG shape) and by any memory-repo test that passes a `status:'revoked'` registered-fallback entry.

### Task 9 dispatch: R10 addendum (fold into the Task 9 brief verbatim)
R6 is RESOLVED via R10 (shadow-upsert, user-approved 2026-08-31). The Task 9 implementer dispatch MUST carry this addendum on top of the plan's Task 9 text:
1. Add `PostgresRepository.registerFederatedSender({ endpoint_id, owner_id, key_id, public_key, origin_domain }, client)` — `INSERT ... ON CONFLICT DO NOTHING` into `humans`, `endpoints`, `endpoint_keys`. Cover EVERY NOT-NULL column with no default (read `001_initial.sql` first — R10's placeholder list is a starting point, not authoritative): endpoints runtime='federated', installation_id=origin_domain, display_name=endpoint_id, status='active'; humans status='active', created_at=now; endpoint_keys algorithm='Ed25519', public_key=<peer-asserted DER bytes>, status='active', valid_from=now.
2. Add `MemoryRepository.registerFederatedSender(...)` — insert into the registry Map; no-op if the endpoint_id key is already present.
3. Task 9 Step 4: call `await repository.registerFederatedSender({...}, client)` INSIDE the `repository.withTransaction` block, BEFORE `persistAcceptedEnvelope(...)`. Source: relay-attested `senderOwnerId`, `envelope.sender.endpoint_id`, `envelope.signature.key_id`, peer-asserted `senderKey.publicKey` (base64url -> DER Buffer), `originDomain`.
4. Amend migration 017 (still unreleased) — add `ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS origin_domain TEXT;`. registerFederatedSender sets it; local registrations leave it NULL. Recount any `$N`-placeholder / column-count assertion on ANY INSERT the task writes or touches (per R3 precedent).
5. New live-DB test (checklist item still owed): POST a federated envelope whose sender is absent from endpoints/humans/endpoint_keys; assert the `envelopes` row exists afterward AND `endpoints.origin_domain` = the origin domain. Gate on `SIGIL_TEST_DATABASE_URL` (model near postgres-repository.test.mjs:101 which already fakes a 23503 on INSERT INTO envelopes). This test also pins R11 (it is the only path returning the status-less PG recipient shape).
Task 9 file set therefore = plan's 3 (accept-federated-envelope.mjs, .test.mjs, memory-repository.mjs) + postgres-repository.mjs + sigil/migrations/017_federation_outbox.sql + the new live-DB test file. R10 authorises this expansion.

## Progress (Batch 3)
BASE for Task 8 = aa8fe981d3498811f07bd574f68ab0c055547067

### Task 8 — accept-federated-envelope.mjs checks 1-5
- Implementer (haiku, agent a3e711f31aaec0ffb): DONE, commit d122815. Verbatim from brief. RED (module missing) -> GREEN 7/7 focused; npm test 702 pass / 0 fail / 67 skip.
- Files: sigil/relay/v1/accept-federated-envelope.mjs (new, 57), sigil/relay/v1/accept-federated-envelope.test.mjs (new, 95).
- Review package: review-aa8fe98..d122815.diff (BASE aa8fe98, HEAD d122815, 1 commit).
- Task 8 REVIEWER dispatched: sonnet, agent ad1235bb7a033ac37. Fed global constraints + the pre-scan note (unused canonicalJsonBytes import in test, brief-verbatim).
- Task 8 review: Spec ✅ compliant (all 5 checks in order w/ exact status+code pairs; check 4 case-insensitive at :42; stub at :56; `{request_id,code,message,details}` via respond helper; 7 tests match brief; TDD RED/GREEN evidenced; full suite 702/0/67). Task quality APPROVED. No Critical/Important.
- Task 8: minor (deferred): accept-federated-envelope.test.mjs:7 `import { canonicalJsonBytes } from './jcs.mjs'` unused (plan-verbatim; Task 9 may consume it as the file grows, else drop in Task 19 sweep).
- Task 8: minor (deferred): accept-federated-envelope.test.mjs:90-95 "checks 1-5 pass" test asserts only status not-in {400,401,403}; no positive `202` / `code==='ACCEPTED_STUB'` assert (plan-mandated loose so Task 9's stub replacement won't break it). Task 9 should tighten to `code==='ACCEPTED_STUB'` when it edits this file.
- Task 8: complete (commits aa8fe98..d122815, review clean)

### Task 9 — accept-federated-envelope.mjs checks 6-10 (+ R10 shadow-upsert, + R11 recipient-status guard)
BASE for Task 9 = d12281527597049a9adf8a204ee41d58493cb139
- Implementer dispatched: sonnet, agent af6470bbc0ebd31bd. Dispatch carried: brief + R11 ruling (weaken recipient-active guard, PG row has no status field) + full R10 addendum (registerFederatedSender on both repos, Step 4 call before persist, 017 `origin_domain` ALTER, live-DB commit test) + Task-8-review tightening of the stub test. 6-file commit authorised.
- Implementer (af6470bbc0ebd31bd): DONE_WITH_CONCERNS, commit 5d4c386. Task file 13/13; npm test 776/0/68 skip; new live-DB test skips locally. 6 files: accept-federated-envelope.mjs (+115), .test.mjs (+81), .pg.test.mjs (new 109), memory-repository.mjs (+10), postgres-repository.mjs (+29), 017_federation_outbox.sql (+6).
  - CONCERN 1: brief's MESSAGE_EXPIRED fixture (day-old created_at) trips validateEnvelope clock-skew guard -> INVALID_ENVELOPE before expiry check. Implementer realigned that one test to Task 3's over-long-lifetime fixture. PLAN-TEST DEVIATION — flagged to reviewer to confirm it still exercises the 422 MESSAGE_EXPIRED expiry path.
  - CONCERN 2: R10 live-DB SQL / migration order / composite-FK reasoned from 001_initial.sql, not executed. CI live-DB first run.
  - CONCERN 3: `federation_origin` rate scope absent from DEFAULT_RATE_LIMITS -> falls back to endpoint limit (`limits[scopeKind] ?? limits.endpoint`, plan's own expression).
- Review package: review-d122815..5d4c386.diff (BASE d122815, HEAD 5d4c386, 1 commit, 33918 bytes).
- Task 9 REVIEWER dispatched: sonnet, agent a740947a774a5ec21. Fed R10+R11 ruling context + 6 named risks (composite-FK alignment, NOT-NULL coverage vs 001_initial.sql, humans->endpoints->endpoint_keys insert order, R11 guard applied + unknown-recipient still rejects, registerFederatedSender placement after reject-capable checks / before persist, $N recount) + concern-1 deviation verification.
- Task 9 review: Spec ❌ / Task quality NEEDS FIXES. 1 CRITICAL, 0 Important, 6 Minor.
  - VERIFIED CLEAN by reviewer: checks 6-10 order + status/code pairs; idempotent short-circuit first; replay->409; skipSenderRegistration + synthetic Map; same-owner exemption + SENDER_OWNER_ASSERTION_MISMATCH; federation_hop:true on persist; onPersisted still fires (mjs:154); audit accepted/rejected, body never in payload; R11 guard weakened + unknown-recipient still 400; Task 8 stub test replaced with positive assert. R10: NOT-NULL coverage COMPLETE (checked 001 + all later migrations; only 009 touches these tables, GENERATED col); INSERT order humans->endpoints->endpoint_keys correct; composite-FK aligned (check 6 guarantees envelope.sender.owner_id===senderOwnerId before registerFederatedSender); call placement correct (mjs:142, after all rejects, before persist); $N recount fine (envelopes INSERT stays 21). MESSAGE_EXPIRED deviation legit (over-long-lifetime fixture -> genuine 422 via validate-envelope.mjs:108, matches Task 3 fixture).
  - CRITICAL: `federation_origin` rate scope not in `quota_usage_scope_kind_check` CHECK (set by 007, replaced by 012). PG `reserveRateLimit` INSERT INTO quota_usage raises 23514 on every federated accept reaching check 9 -> whole happy path 400s on Postgres; R10 live-DB test `assert.equal(r.status,202)` FAILS on first CI run. Memory reserveRateLimit has no CHECK -> hid locally. Fix: 017 mirrors 012 — DROP + re-ADD `quota_usage_scope_kind_check` with `'federation_origin'` added.
  - Minor (fold into fix round, cheap + adjacent): (a) mjs:157-158 raw driver `error.code` echoed as response `code` (peer sees `"23514"`) — map unknown error.code -> INVALID_FEDERATION_REQUEST unconditionally; (b) realigned MESSAGE_EXPIRED test asserts only body.code — add `assert.equal(r.status, 422)`.
  - Minor (deferred -> Task 19): auditInboundReject/auditReject near-dup (mjs:22-34 vs 79-84); envelope.recipient unguarded -> TypeError caught as 400 (add explicit `if(!envelope.recipient) throw reject('RECIPIENT_NOT_FOUND')`); memory shadow `public_key` stores raw Buffer vs KeyObject (nothing reads it); `federation_origin` limit falls back to endpoint 100/min (no DEFAULT_RATE_LIMITS key — plan-acknowledged, for routing/reaper tasks).

### Task 9 — fix round 1 (dispatched)
FIX_BASE for re-review = 5d4c3864f62f82b1cdd0ec2aaefadec2cd8eb4ba
- Critical is within R10's already-authorised "amend 017 while unreleased" scope — no new ruling; the plan introduced the `federation_origin` scope (line 1303) without its companion CHECK migration. Fix round 1 = Critical (017 CHECK migration mirroring 012) + 2 cheap adjacent minors (unknown-error-code mapping, 422 status assert). Other 4 minors deferred to Task 19.
- Resuming original implementer af6470bbc0ebd31bd.
- Fix round 1 DONE, commit 2a906de. 017 gains DROP+ADD `quota_usage_scope_kind_check` w/ `federation_origin`; `.catch` maps unknown error.code -> INVALID_FEDERATION_REQUEST; MESSAGE_EXPIRED test +`assert.equal(r.status,422)`. Task file 13/13; npm test 776/0/68 skip; audits pass. pg suite still skips locally.
- Scoped re-review dispatched: sonnet, agent aeb7541f6821b90a7. FIX_BASE 5d4c386, HEAD 2a906de, pkg review-5d4c386..2a906de.diff. Named checks: 017 IN-list = newest prior def + federation_origin (no dropped value); .catch allow-list didn't disturb the legit code->status maps.
- Task 9 fix round 1/5 (3 addressed, 0 open — federation_origin CHECK migration + unknown-error-code mapping + 422 status assert; commits 5d4c386..2a906de). Re-review: 017 reproduces 012's 7 values verbatim + appends federation_origin (012 is newest prior def; no value dropped); `statusByCode` allow-list faithful copy of prior inline map, unknown codes collapse to INVALID_FEDERATION_REQUEST/400/generic-msg (raw driver message also suppressed); MESSAGE_EXPIRED test +status assert. No new breakage.
- Task 9: complete (commits d122815..2a906de, review clean; 4 minors deferred to Task 19 — see review block above)

### Task 10 — HTTP route POST /v1/federation/envelopes
BASE for Task 10 = 2a906de7ae79c60f42a1a13fe612360dc10e8f6f
- Implementer dispatched: sonnet, agent abbc60b2424a39812. Dispatch resolved 4 brief ambiguities: (1) route placement — Files-header "after line 229" is WRONG (that's inside the authed /v1/envelopes handler); Step 3 is operative: between /v1/health block and the authenticateRequest gate (~146-152). (2) `now` — createRelayServer destructures `now: configuredNow = () => new Date()`, use the sibling handlers' local `now` name. (3) pathname match — confirm `parsedUrl` in scope else match sibling `request.url ===` style. (4) add `federationMode`/`federationIdentity`/`fetchImpl` to destructure (Tasks 11-12 consumers, thread only).
- Implementer (abbc60b2424a39812): DONE, commit 35a7c15. Route at http-server.mjs:152-174 (between /v1/health and auth gate). Reports `now` name is "bare `now` (unchanged)" — flagged to reviewer to verify it's a real in-scope binding not a dangling ref. Matched `parsedUrl.pathname`. 3 new option keys added, oidcFetchImpl untouched. new file 2/2 (RED 404 -> GREEN 202/403); http-server.test.mjs 47/47; npm test 710/0/68 skip; audits PASS. Concern (non-blocking): 413 / bad-JSON branches not separately tested (verbatim from siblings, outside brief minimum).
- Review package: review-2a906de..35a7c15.diff (BASE 2a906de, HEAD 35a7c15, 1 commit, 12834 bytes).
- Task 10 REVIEWER dispatched: sonnet, agent ac4e7bf4446798ac9. Named risks: route above auth gate; `now` resolves to a real value; onPersisted `{envelope:accepted,persisted}` shape + `persisted?.duplicate` guard; no reorder/rename of existing options or routes.
- Task 10 review: Spec ✅ compliant, Task quality APPROVED. All 4 named risks CLEAR: route at http-server.mjs:155-173 sits between /v1/health (ends :150) and auth gate (diff :198-199) — federated POST resolves before bearer-auth; `now` IS a real binding (http-server.mjs:69 `const now = typeof configuredNow === 'function' ? configuredNow() : configuredNow;` inside the handler closure — implementer traced it correctly); onPersisted shape matches handler (`{envelope,persisted}` in, `persisted?.duplicate` guard, `!stream` + `accepted.recipient?.endpoint_id` guards); diff = 1 import + 3 appended destructure keys (oidcFetchImpl untouched, order preserved) + 1 route block, nothing else. 413/400-JSON/lowercase-headers/`x-sigil-request-id`/body-shape all correct. No Critical/Important.
- Task 10: minor (deferred): http-server.mjs:168 `onPersisted` reads `persisted.message_id` without `?.` while accept-federated-envelope.mjs uses `persisted?.message_id ?? result.message_id` everywhere; if persist ever returned nullish, `persisted?.duplicate` guard passes and this throws inside an un-try/catch'd awaited callback -> 500/hang instead of 202. Low impact (persisted always an object). Tighten for consistency.
- Task 10: minor (deferred): http-server.federation-inbound.test.mjs has no dedicated 413 (body cap) / 400 bad-JSON test; route branches copied verbatim from siblings, outside brief minimum. Coverage-broadening for Task 19 sweep.
- Task 10: complete (commits 2a906de..35a7c15, review clean)

===================================================================
## BATCH 3 FINISHED — clean. Branch stays OPEN for Batch 4.
===================================================================
Branch feat/federation-inter-relay-routing @ 35a7c15 (13 commits ahead of sigil-repo main 7c2e867; 4 new this batch):
  d122815  Task 8   acceptFederatedEnvelope checks 1-5 (structural, trust, relay sig, sender domain, envelope sig)
  5d4c386  Task 9   acceptFederatedEnvelope checks 6-10 (validate, same-owner exemption, deliver) + R10 shadow-upsert + R11 guard
  2a906de  Task 9 fix  federation_origin quota_usage CHECK migration + unknown-error-code mapping + 422 status assert
  35a7c15  Task 10  POST /v1/federation/envelopes route (unauthenticated, before auth gate)
All 3 tasks: review clean. Task 9 needed 1 fix round (federation_origin CHECK migration — memory reserveRateLimit has no CHECK so it hid the PG 23514 locally). Tasks 8 + 10 clean first pass.
sigil/relay/v1/accept-federated-envelope.test.mjs 13/13 ; http-server.federation-inbound.test.mjs 2/2 ; http-server.test.mjs 47/47. npm test green each task (67-68 skip = no live DB/Ollama locally).
NO batch-end whole-branch review (plan line 1933 — only after Task 19). Per-task reviews only.
PUSHED 2026-08-31 to origin/feat/federation-inter-relay-routing (local == origin == 35a7c15). Pre-push gate green: 778 tests / 710 pass / 0 fail / 68 skip; dep-audit + jcs-audit PASS; live-Ollama verified. Workspace + ledger RETAINED for Batches 4-6.

### R6 / R10 status
R6 (envelopes FK chain blocks federated persist on Postgres) is RESOLVED IN CODE this batch via R10 shadow-upsert: `PostgresRepository.registerFederatedSender` + `MemoryRepository.registerFederatedSender` (INSERT ... ON CONFLICT DO NOTHING into humans/endpoints/endpoint_keys), called inside acceptFederatedEnvelope's transaction after all reject-capable checks, before persist. Migration 017 amended: `ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS origin_domain TEXT` + `quota_usage_scope_kind_check` DROP/ADD with `federation_origin`. Reviewer verified NOT-NULL coverage complete (checked 001 + all later migrations), INSERT order (parents first), composite-FK alignment.
STILL OWED (R10 pt 5, carried): the live-DB test EXISTS (sigil/relay/v1/accept-federated-envelope.pg.test.mjs, asserts 202 + envelopes row + endpoints.origin_domain) but SKIPS locally (no SIGIL_TEST_DATABASE_URL). CI live-DB matrix is its FIRST real execution of the entire R10 path (registerFederatedSender SQL, migration order, composite FK, the federation_origin CHECK). If CI live-DB is red on the next push, that test is where to look.

### Deferred minors from Batch 3 (fold into Task 19 docs/cleanup pass)
- accept-federated-envelope.test.mjs:7 unused `import { canonicalJsonBytes } from './jcs.mjs'` (T8, plan-verbatim; Task 9 did not end up consuming it).
- accept-federated-envelope.mjs (T9): auditInboundReject/auditReject near-duplication (mjs:22-34 vs 79-84) — one helper w/ optional response return.
- accept-federated-envelope.mjs (T9): `envelope.recipient.endpoint_id` unguarded — a federated broadcast envelope passes validateEnvelope then throws TypeError caught as 400/INVALID_FEDERATION_REQUEST. Add explicit `if (!envelope.recipient) throw reject('RECIPIENT_NOT_FOUND', ...)`.
- memory-repository.mjs (T9): shadow `registerFederatedSender` entry stores raw `public_key` Buffer vs real registry entries' KeyObject. Nothing reads it back; harmless but inconsistent.
- accept-federated-envelope.mjs (T9): `federation_origin` rate scope has no key in `DEFAULT_RATE_LIMITS` -> falls back to `limits.endpoint` (100/min). Plan-acknowledged; decide the real limit in Batch 4/5 (routing/reaper).
- http-server.mjs:168 (T10): `onPersisted` `persisted.message_id` missing `?.` vs the `persisted?.message_id ?? result.message_id` idiom used everywhere else in accept-federated-envelope.mjs.
- http-server.federation-inbound.test.mjs (T10): no dedicated 413 / bad-JSON branch test.
- accept-federated-envelope.test.mjs (T9): the realigned "expired envelope" test actually exercises the over-long-lifetime path (validate-envelope.mjs:108), not a genuinely past-`expires_at` envelope — `validateEnvelope` has NO wall-clock `expires < now` check at all. Label overstates coverage; a true past-expiry test belongs in Task 19.

### Rulings made (Batch 3) — for the finish list
- R11 (T9): the plan's Task 9 Step 4 recipient-active guard `recipient.status !== 'active'` is a self-consistency defect on the Postgres path — `PostgresRepository.lookupRecipientEndpoint` returns `{endpoint_id, owner_id}` with NO `status` field (SQL already active-filters), so the guard throws `RECIPIENT_NOT_FOUND` for every valid federated recipient on live DB; memory-repo tests stay green because the memory method returns an entry carrying `status`. Ruled: implementer MUST weaken the guard to reject only on an explicit non-active status (`recipient.status !== undefined && recipient.status !== 'active'`). Spec intent ("recipient exists and is active") holds — both repos active-filter before returning. Cost if wrong: one-line predicate change in a new file, visible in diff, pinned by R10's live-DB test (only path returning the status-less PG shape). — IMPLEMENTED + reviewer-verified (guard weakened; unknown-recipient test still reaches RECIPIENT_NOT_FOUND).
- (R10 pt-4 consequence, no new letter): the `federation_origin` rate scope the plan introduced at line 1303 had no companion `quota_usage_scope_kind_check` migration — on Postgres every federated accept raised 23514. Fixed inside R10's already-authorised "amend 017 while unreleased" scope: 017 now DROP/ADDs the CHECK with `federation_origin` appended to 012's 7-value list (no value dropped). Not a separate ruling — a gap-fill within R10.

### Batch 4 start checklist (fresh session)
1. Preflight: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing (expect branch feat/federation-inter-relay-routing, HEAD 35a7c15 or the pushed HEAD).
2. Re-run superpowers:subagent-driven-development. Tasks with `Task N: complete` are DONE (1-10). Resume at Task 11.
3. Run the pre-execution conflict scan for Batch 4's task set (Tasks 11-12: origin sync-mode forwarding in acceptWithRepository + `sigil relay up --federation-mode sync --federation-identity`). Append the tables here. Note: Task 11 REPLACES the `checkRecipientLocality` call in accept-envelope.mjs with `decideRoute` (Batch 2's federation-router.mjs) — check the decideRoute signature + return shape against what Task 11 expects.
4. R10 live-DB test is the open verification item — confirm CI live-DB status after any push before relying on the federated persist path.

===================================================================
## Session 7 (2026-08-31) — Batch 4 (Tasks 11-12, sync origin)
===================================================================
- Preflight: verify-repo-context.ps1 -Path <worktree> => PREFLIGHT_PASS, branch feat/federation-inter-relay-routing, HEAD 35a7c15e058ec746578d83a5ba638d4717f8033f == origin/feat/federation-inter-relay-routing. Clean tree. Matches Batch 3 finish line.
- Batch scope: Tasks 11-12 ONLY (plan line 1934). No batch-end whole-branch review (plan line 1933 — only after Task 19). Per-task reviews only; branch stays open for Batch 5.
- R6/R10: not in Batch 4's blast radius — Tasks 11-12 touch accept-envelope.mjs (origin send path), http-server.mjs (/v1/envelopes wiring), sigil.mjs (cmdRelayUp). No 001_initial.sql / migrations / persist / receiver code. R10 live-DB test remains the open CI verification item, unchanged.

### Preflight conflict scan (RAN 2026-08-31, session 7) — Batch 4 = Tasks 11-12

#### Consumed-interface existence check (all at HEAD 35a7c15)
| Symbol | Source:line | Used by | Status |
|---|---|---|---|
| decideRoute | federation-router.mjs:9 | T11 | PRESENT — `(envelope, {relayDomain, federationMode, getPeerByDomain, storedFederationHop=false})` → `{action:'local'|'reject'|'forward', code?, details?:{recipientDomain}, peer?, recipientDomain?}`. Matches T11's call args + the `route.action`/`route.code`/`route.details`/`route.peer`/`route.recipientDomain` reads. When `!federationMode` it calls `checkRecipientLocality(envelope, relayDomain)` then returns `{action:'local'}` — regression path preserved. |
| buildForwardRequest | federation-router.mjs:45 | T11 | PRESENT — returns `{body, canonicalBytes}`; T11 destructures `{canonicalBytes}`. ✓ |
| signForwardRequest | federation-router.mjs:56 | T11 | PRESENT — `(canonicalBytes, identity)` → `{signature, keyId}`; reads `identity.private_key_pem` + `identity.key_id`. `loadIdentity` object carries both (identity.mjs:10,14 via createIdentity). ✓ |
| postForward | federation-router.mjs:65 | T11 | PRESENT — `(peer, canonicalBytes, {signature,keyId}, {fetchImpl=fetch})` → `{ok:true,status}` | `{ok:false,status,peerCode?}`; throws `Object.assign(Error, {code:'FORWARD_TRANSPORT_FAILED'})` on transport AND on real peer 5xx. Matches T11's `signed` shape + the `error.code==='FORWARD_TRANSPORT_FAILED'` catch. |
| checkRecipientLocality, reject | validate-envelope.mjs (re-exported through federation-router import line 3) | T11 | PRESENT |
| acceptWithRepository / statusByCode / the line-75 `checkRecipientLocality(envelope, options.relayDomain)` call | accept-envelope.mjs:53 / :11 / :75 | T11 | PRESENT — plan's line anchors (53/11/75) are EXACT at this HEAD |
| createRelayServer destructure incl. `federationMode, federationIdentity, fetchImpl` | http-server.mjs:33 | T11 | PRESENT (added by Task 10) |
| `/v1/envelopes` handler + its `acceptEnvelopeAsync(envelope, {...})` options object | http-server.mjs:233 / :236-250 | T11 Step 4 | PRESENT — plan Step 4 says "line 212"/"line 212"; actual ~233/236 (~24-line drift from Task 10). `now` at :237 is a real binding (http-server.mjs:69, Task 10 review verified). Current options: `registered, request_id, now, repository, relayDomain, persist, onPersisted` — T11 adds `federationMode, federationIdentity, fetchImpl`. No key collision. |
| loadIdentity | sigil/cli/identity.mjs:20 | T12 | PRESENT + already imported at sigil.mjs:20. Throws Error on missing file; JSON.parse throws on non-JSON — satisfies plan Task 12 "let loadIdentity's error propagate". |
| cmdRelayUp / its parseArgs options / `databaseUrl` / `relayDomain` / `createRelayServer({...})` call | sigil.mjs:146 / :147 / :151 / :158 / :224 | T12 | PRESENT — plan lines 133/147/145/212 are ~13-24 lines stale; every named var + the call site exist. sigil.mjs:224 call does NOT pass `fetchImpl` and T12 does not add it — fine (postForward defaults to global `fetch`; `fetchImpl` is a test-only injection seam). |
| accept-envelope.federation-sync.test.mjs / relay-up-federation.test.mjs | — | T11 / T12 create | ABSENT — confirmed |

#### Cross-task table (Batch 4 = Tasks 11-12)
| Pair | Shared file / interface | Producer -> Consumer | Finding |
|---|---|---|---|
| T11 x T12 | `createRelayServer` options `federationMode` + `federationIdentity` | T12 (cmdRelayUp) passes them into `createRelayServer`; T11 + Task 10 (server) destructure them and thread into `acceptEnvelopeAsync` -> `forwardEnvelope` | no shared file; no symbol clash; key names verified byte-identical against http-server.mjs:33. Sequential T11 -> T12. CLEAN |
| T11 -> Task 14 | `enqueueForward(envelope, route, options, client, {senderKey, senderOwnerId})` | T11 emits the call on the `federationMode === 'queue'` branch of `forwardEnvelope`; Task 14 defines `enqueueForward` | plan-mandated forward reference (`// Task 14` in the plan's own code block). Ruling R12. |
| T11 -> Task 12/16 | `federationMode === 'queue'` runtime path | — | queue mode is unreachable in Batch 4: T12 gates `--federation-mode queue` on `--database-url`, and no reaper/queue server wiring lands until Task 16. Only `sync` is reachable + tested this batch. |
| batch -> later | `acceptWithRepository` new `options` (`federationMode`/`federationIdentity`/`fetchImpl`/`postForwardImpl`), module-level `forwardEnvelope`/`recordFederationAudit`, 5 new `statusByCode` codes | consumed by Tasks 14/16 (queue branch) | additive; nothing in 11-12 consumes another's runtime output beyond the T11->T12 wiring above | CLEAN |

#### Self-consistency table
| Task | Own text checked | Finding |
|---|---|---|
| T11 | 4 Step-1 tests vs `forwardEnvelope` branches: `postForwardImpl {ok:true}` -> 202 `forwarded:true`/`forwarded_to`; `{ok:false,status:403,peerCode}` -> 502 FORWARD_REJECTED; throws FORWARD_TRANSPORT_FAILED -> 504 FORWARD_UNAVAILABLE; sender w/o registered key -> 500 FORWARD_MISCONFIGURED | OK — every test maps to a branch. `postForwardImpl` is a plan-introduced test seam (`options.postForwardImpl ?? postForward`); injected impls bypass real postForward's 5xx->throw so the 502 path is reachable only via injection (real peer 5xx -> 504). Consistent with the plan's catch logic; note only. |
| T11 | test asserts "nothing in `repo._debugGetEnvelope`" after a forward | OK — `forwardEnvelope` returns before `persistAcceptedEnvelope`; the plan's Note acknowledges the resulting no-op transaction and says not to restructure. |
| T11 | `forwardEnvelope` senderEntry = `registered.get(sender.endpoint_id) ?? repository.lookupRecipientEndpoint(sender.endpoint_id, client)`; reads `.owner_id` + `.public_key` | OK for tested + real paths — the Step-1 test seeds `registered` with owner+key, and the real `/v1/envelopes` handler populates `registered` (trusted directory) for every authenticated sender, so `registered.get(...)` hits first. The fallback is BROKEN on Postgres (`PostgresRepository.lookupRecipientEndpoint` returns `{endpoint_id, owner_id}` — NO `public_key`; same shape gap as R11) but is never reached. Impl-time verify note + carry to Task 19 / whole-branch review; not a ruling. |
| T11 | `decideRoute` replaces `checkRecipientLocality` at line 75; plan claims "with `federationMode` undefined ... every existing path is byte-identical" | OK — decideRoute line 10 short-circuits broadcast (`!envelope.recipient`) to `{action:'local'}` and line 14 delegates to `checkRecipientLocality(envelope, relayDomain)` for the no-federation case. Batch 2 conflict scan + Task 4 review already verified decideRoute's branches; `checkRecipientLocality(envelope, undefined)` early-returns. Regression suite (Step 6) is the pin. |
| T11 | `import { decideRoute, buildForwardRequest, signForwardRequest, postForward } from './federation-router.mjs'` (Step 3) — all 4 exported | OK — verified at federation-router.mjs:9/45/56/65 |
| T11 | `statusByCode` additions `PEER_NOT_PINNED:400, FEDERATION_HOP_EXCEEDED:400, FORWARD_MISCONFIGURED:500, FORWARD_REJECTED:502, FORWARD_UNAVAILABLE:504` | OK — none currently present in accept-envelope.mjs:11-29; `MALFORMED_FEDERATED_ID:400` already there and decideRoute throws exactly that code for a malformed federated recipient. No collision. |
| T12 | 5 Step-1 tests (bogus mode / queue w/o db-url / sync w/o identity / sync w/o domain / missing identity file) vs the Step-3 guard block | OK — every guard present; order (mode-valid -> relayDomain-set -> identity-path-set -> loadIdentity -> queue-needs-db) matches. |
| T12 | Step-1 test setup runs `sigil init a --domain a.example`; `cmdInit` (sigil.mjs:95) does `if (domainHost !== 'local') await resolveDomainOrThrow(domain)` — real `dns.promises.lookup`, no test bypass (federated-id.mjs:70-91) | CONFLICT — `a.example` (RFC 2606) does not DNS-resolve, so the `sigil init` setup throws (`DNS_LOOKUP_FAILED`/`DNS_TIMEOUT`) before any test assertion runs. Identical defect class to Batch 1 R2. Ruling R13. |
| T12 | `cmdRelayUp` parseArgs adds `'federation-mode'` + `'federation-identity'` | OK — no collision with existing (`registry/port/stream-port/database-url/enable-mock-oidc/oidc-issuer-refresh-interval-ms/domain`). |
| T12 | Step-3 federation block references `relayDomain` (sigil.mjs:158) + `databaseUrl` (sigil.mjs:151) | OK — both in scope at the insertion point (plan says "after the relayDomain block ~145-151"; actual relayDomain block ~158-168). |
| T12 | plan Step 3 "Add `loadIdentity` to the import ... if not already imported" | OK — already imported at sigil.mjs:20. |

### Rulings (pre-execution, Batch 4)
- R12 (T11): the `forwardEnvelope` queue branch MUST ship the bare `return enqueueForward(envelope, route, options, client, { senderKey, senderOwnerId });` forward-reference verbatim per the plan's own code block (the `// Task 14` marker). Do NOT add a local stub / throwing placeholder — that is dead code Task 14 must then strip, and it changes the plan-specified module shape. The queue path is unreachable in Batch 4 (Task 12 gates `--federation-mode queue` on `--database-url`; no queue/reaper server wiring until Task 16; every Batch-4 test exercises `sync`). ES modules resolve an undefined identifier at call time, not load time, so the module loads and `sync` mode is unaffected. — Cost if wrong: if someone runs `sigil relay up --federation-mode queue ...` in the window between Task 12 and Task 14 and a foreign-recipient send reaches `forwardEnvelope`, `enqueueForward` throws `ReferenceError`, caught by `acceptWithRepository`'s existing `.catch` -> `toResponse` -> generic 400 (server stays up); resolved the moment Task 14 lands the function.
- R13 (T12): Task 12 Step 1 tests MUST use `--domain local` (not `--domain a.example`) in the `sigil init` setup and in the `sigil relay up` args. `cmdInit` runs `resolveDomainOrThrow` for every non-`local` host (sigil.mjs:95) and RFC 2606 `a.example` does not DNS-resolve, so the setup step throws before the test asserts anything. `local` skips DNS; `parseDomain('local')` passes `cmdRelayUp`'s domain validation (federated-id.mjs:20 special-case); the `--federation-mode requires --domain` guard is still exercised by including/omitting `--domain local`. These are pure CLI-validation tests — no cross-domain identity is needed. Identity file path stays `.sigil/a.identity.json` (`sigil init a --domain local` writes exactly that). Mirrors Batch 1 R2. — Cost if wrong: test-only domain-literal churn in one new test file, fully visible in diff, revertible.

## Progress (Batch 4)
BASE for Task 11 = 35a7c15e058ec746578d83a5ba638d4717f8033f

### Task 11 — origin sync-mode forwarding in acceptWithRepository
- Brief: task-11-brief.md (generated, 106 lines). Dispatch carried R12 (ship `enqueueForward` forward-ref verbatim) + impl-time notes: line drift on http-server anchors (~236 not 212), `now` at http-server.mjs:237 is a real binding, `forwardEnvelope`'s `lookupRecipientEndpoint` fallback is PG-broken-but-unreached.
- Implementer dispatched: sonnet, agent a61d2d11a96dfee18 (resume this for fix rounds 1-3).
- Implementer (a61d2d11a96dfee18): DONE, commit 0eefc69. RED 0/4 (all `actual: 400` RECIPIENT_NOT_LOCAL) -> GREEN 4/4 focused; regression 75/75 + 25/25 federation-adjacent green. Full `npm test` 712 pass / 68 skip / 2 fail — both (`live-ollama-worker-test.mjs`, `inbox-wait.test.mjs:223` heartbeat timing) proven pre-existing via `git stash` re-run at clean HEAD 35a7c15; inbox-wait 16/16 isolated. R12 followed (bare `enqueueForward` forward-ref, no stub).
- Review package: review-35a7c15..0eefc69.diff (BASE 35a7c15, HEAD 0eefc69, 1 commit, 17527 bytes).
- Task 11 REVIEWER dispatched: sonnet, agent a492c06f8908bd31d. Fed global constraints + 6 named risks (decideRoute legacy-path equivalence, return-before-persist, response shapes + 5 statusByCode adds, http-server additive wiring, audit no-body, the 2 pre-existing npm-test fails) + R12 exclusion (do not flag the `enqueueForward` forward-ref).
- Task 11 review: Spec ✅ compliant, Task quality APPROVED. All 6 named risks CLEAR: legacy path byte-equivalent (decideRoute:14-17 delegates to checkRecipientLocality when !federationMode; :10 no-recipient short-circuit matches validate-envelope.mjs:50); forward branch returns before persistAcceptedEnvelope (accept-envelope.mjs:91-92), test asserts `persistCalled===false` + `_debugGetEnvelope===null`; all 4 outcomes carry `{request_id,code,message,details}`, 5 new statusByCode entries added, existing untouched (trailing comma only); http-server purely additive (federationMode/federationIdentity/fetchImpl already destructured :33; /v1/federation/envelopes route untouched); recordFederationAudit payload has no envelope body; pre-existing-fail claim corroborated (MEMORY.md already references inbox-wait.test.mjs:223 as prior-batch open item; no causal path to the 3 changed files). Tests use real Ed25519 keys + injected postForwardImpl + per-branch audit eventType asserts. No Critical/Important.
- Task 11: minor (deferred): accept-envelope.mjs ~258-259 — buildForwardRequest+signForwardRequest run before the `queue`-mode check, so queue does signing it may redo in Task 14. Brief-mandated ordering.
- Task 11: minor (deferred, COVERED by Task 12): accept-envelope.mjs:259 — `federationMode` set but `federationIdentity` undefined → `crypto.createPrivateKey(undefined)` raw TypeError → generic 400 not FORWARD_MISCONFIGURED. Task 12's `--federation-mode requires --federation-identity` startup guard prevents this state; a defensive guard here would still be tidier. Task 19.
- Task 11: minor (deferred): accept-envelope.mjs ~285 — `recordFederationAudit` sets `outcome:'rejected'` for `federation.forward_unavailable` (transport failure, not peer rejection) because `endsWith('forwarded')` is the only success test. Verbatim from brief; cosmetic. Task 19.
- Task 11: minor (deferred): accept-envelope.mjs ~180-181 — FORWARD_REJECTED / FORWARD_UNAVAILABLE statusByCode entries are dead on the sync path (responses built inline with explicit 502/504); PEER_NOT_PINNED / FEDERATION_HOP_EXCEEDED entries ARE used via the `route.action==='reject'` throw. Brief-mandated; harmless. Task 19.
- Task 11: complete (commits 35a7c15..0eefc69, review clean)

### Task 12 — sigil relay up --federation-mode sync --federation-identity
BASE for Task 12 = 0eefc69780fb817c0c56491eb29f2bc1fd231ed4
- Brief: task-12-brief.md (95 lines). Dispatch carried R13 (`--domain local` not `a.example` in the new test) + stale-anchor corrections (cmdRelayUp ~146, parseArgs ~147, databaseUrl ~151, relayDomain ~158-168, createRelayServer call ~224, loadIdentity already imported :20) + the 2 known pre-existing npm-test fails.
- Implementer dispatched: haiku, agent a61b6f85a53a50d67 (resume for fix rounds 1-3).
- Implementer (a61b6f85a53a50d67): DONE, commit bab39b2. Federation tests 5/5 PASS; regression relay-up-domain 4/4 PASS; postgres-startup integration 2/2 SKIP (no live DB). R13 applied (`--domain local`). Error strings verbatim. Report summary did NOT quote full `npm test` counts — reviewer to confirm from report.
- Review package: review-0eefc69..bab39b2.diff (BASE 0eefc69, HEAD bab39b2, 1 commit, 12247 bytes).
- Task 12 REVIEWER dispatched: sonnet, agent ad9ae67064e95b212. Fed global constraints + verbatim error strings + 6 named risks (guard ordering/placement + 5 abort messages + happy path, createRelayServer additive, loadIdentity propagation, parseArgs additions, tests exercise real pre-bind behavior + pristine output, npm-test counts present in report) + R13 authorisation (do not flag `--domain local`).
- Task 12 review: Spec ✅ compliant, Task quality APPROVED. All 9 checks CLEAR: guard block sits after relayDomain/parseDomain validation, before loadRegistryFile/createRelayServer/listen (runs pre-bind); 5 abort messages verbatim (sigil.mjs:157-162); happy path does not abort; `createRelayServer` call (:186) gains exactly `federationMode, federationIdentity` — names match consumer http-server.mjs:33; `loadIdentity` throw propagated un-wrapped to shared handler (stderr via console.error, no stack to stdout); parseArgs additions no collision; each test `execFileSync`-shells real `sigil relay up` + `assert.throws` stderr regex, pre-bind exit, no port opened; queue-without-db-url reaches its own gate (not masked); R13 `--domain local` applied; usage text extended. Near-verbatim transcription of brief Step 3.
  - 1 ⚠️ / Important (named-risk 6): implementer did NOT run full `npm test` (report lines 124-125) — only task file + 2 regression files. RESOLVED BY CONTROLLER: ran `npm test` in worktree at HEAD bab39b2 => 787 tests / 719 pass / 0 fail / 68 skip (live-ollama test passed this run, 457s; dep-audit + jcs-audit ran clean). No open code defect.
  - Minor (deferred → Task 19): (a) no positive-path test that a valid `--federation-mode sync ... --domain local` actually starts the relay + `federationMode` reaches `createRelayServer` (brief Step 1 enumerated only negative cases); (b) doubled message prefix `sigil: sigil relay up: ...` on stderr (thrown strings begin `sigil relay up:`, handler prepends `sigil: `) — matches existing cmdRelayUp throw behavior, brief mandates the exact strings, not a defect.
- Note: Task 12 implementer's post-report follow-up messages claimed "pushed" — FALSE. Verified `git status`: local ahead 2 (0eefc69, bab39b2), origin still at 35a7c15. Nothing was pushed mid-batch.
- Task 12: complete (commits 0eefc69..bab39b2, review clean)

===================================================================
## BATCH 4 FINISHED — clean. Branch stays OPEN for Batch 5.
===================================================================
Branch feat/federation-inter-relay-routing @ bab39b2 (15 commits ahead of sigil-repo main 7c2e867; 2 new this batch):
  0eefc69  Task 11  sync-mode foreign-envelope forwarding via decideRoute
  bab39b2  Task 12  sigil relay up --federation-mode sync --federation-identity
Both tasks: review clean (no Critical/Important). No fix loops. Task 12's one ⚠️ (full npm test unrun by implementer) closed by controller running it: 787 / 719 pass / 0 fail / 68 skip.
sigil/relay/v1/accept-envelope.federation-sync.test.mjs 4/4 ; sigil/cli/relay-up-federation.test.mjs 5/5 ; regression relay-up-domain 4/4, accept-envelope 75/75.
NO batch-end whole-branch review (plan line 1933 — only after Task 19). Per-task reviews only.
PUSHED 2026-08-31 to origin/feat/federation-inter-relay-routing (35a7c15..bab39b2; local == origin == bab39b2). Pre-push gate green: 787 tests / 719 pass / 0 fail / 68 skip, "Pre-push verification passed." Workspace + ledger RETAINED for Batches 5-6.

### CARRY-FORWARD to Batch 5 (R6/R10 status unchanged)
R6 resolved in code (Batch 3, R10 shadow-upsert). STILL OWED (R10 pt 5): sigil/relay/v1/accept-federated-envelope.pg.test.mjs exists but SKIPS locally (no SIGIL_TEST_DATABASE_URL). CI live-DB matrix is the first real execution of the whole R10 Postgres path (registerFederatedSender SQL, migration 017 order, composite FK, federation_origin quota_usage CHECK). If CI live-DB is red after a push, look there first. Batch 5 = Tasks 13-16 (queue + reaper) — Task 14 defines `enqueueForward` (the R12 forward-reference in accept-envelope.mjs:~258 becomes live).

### Deferred minors from Batch 4 (fold into Task 19 docs/cleanup pass)
- accept-envelope.mjs ~258-259 (T11): buildForwardRequest+signForwardRequest run before the `queue`-mode check — queue does signing work Task 14 may redo. Brief-mandated ordering.
- accept-envelope.mjs:259 (T11): `federationMode` set + `federationIdentity` undefined → `crypto.createPrivateKey(undefined)` raw TypeError → generic 400 not FORWARD_MISCONFIGURED. Task 12's startup guard prevents this state; a defensive guard in forwardEnvelope would still be tidier.
- accept-envelope.mjs ~285 (T11): `recordFederationAudit` sets `outcome:'rejected'` for `federation.forward_unavailable` (transport failure, not peer rejection) — `endsWith('forwarded')` is the only success test. Cosmetic, brief-verbatim.
- accept-envelope.mjs ~180-181 (T11): FORWARD_REJECTED / FORWARD_UNAVAILABLE statusByCode entries dead on the sync path (inline 502/504). PEER_NOT_PINNED / FEDERATION_HOP_EXCEEDED entries ARE used. Brief-mandated, harmless.
- sigil/cli/relay-up-federation.test.mjs (T12): no positive-path test (valid flags actually start the relay + reach createRelayServer).
- sigil/cli/sigil.mjs (T12): doubled `sigil: sigil relay up: ...` stderr prefix on cmdRelayUp aborts (pre-existing pattern; brief mandates the strings).

### Rulings made (Batch 4) — for the finish list
- R12 (T11): the `forwardEnvelope` queue branch ships the bare `enqueueForward(...)` forward-reference verbatim per plan (`// Task 14`), no stub/placeholder — Task 14 defines it, queue path unreachable this batch, ES modules resolve the identifier at call time so sync mode is unaffected. Cost if wrong: running `--federation-mode queue` between Task 12 and Task 14 + a foreign-recipient send → `ReferenceError` caught by the existing `.catch` → generic 400 (server stays up); resolved when Task 14 lands.
- R13 (T12): Task 12 Step 1 tests use `--domain local`, not `--domain a.example` — `cmdInit` runs a real DNS `resolveDomainOrThrow` for every non-`local` host (sigil.mjs:95) and RFC 2606 `a.example` does not resolve, so the `sigil init` setup throws before any assertion. `local` skips DNS and still exercises every validation gate (mode-valid, requires-domain, requires-identity, queue-requires-db-url, missing-identity-file). Mirrors Batch 1 R2. Cost if wrong: test-only domain-literal churn in one new file, visible in diff.

### Batch 5 start checklist (fresh session)
1. Preflight: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing (expect branch feat/federation-inter-relay-routing, HEAD bab39b2 or the pushed HEAD).
2. Re-run superpowers:subagent-driven-development. Tasks with `Task N: complete` are DONE (1-12). Resume at Task 13.
3. Run the pre-execution conflict scan for Batch 5's task set (Tasks 13-16: federation_outbox repo methods (PG), queue-mode enqueue in acceptWithRepository, reaper pass + driver, wire reaper into `sigil relay up` queue mode). Append the tables here. Watch: Task 14 defines `enqueueForward` consumed by the R12 forward-reference at accept-envelope.mjs (sync file, ~line 258); Task 15/16 reaper reads federation_hop persist + the outbox row shape from migration 017.
4. R10 live-DB test is still the open CI verification item.

===================================================================
## Progress (Batch 5 — Tasks 13-16: federation_outbox repo + queue enqueue + reaper + wiring)
===================================================================
Session start 2026-08-31. Worktree HEAD == origin == bab39b2. Preflight PASS (branch feat/federation-inter-relay-routing).
BASE for Task 13 = bab39b2887a74125c3fbd8c6c0184000293b6f1f

### Pre-execution conflict scan (Batch 5)

Cross-task interface pairs (shared file / produced-vs-consumed):
| Pair | Producer output | Consumer expectation | Finding |
|---|---|---|---|
| T13 → T14 | `enqueueFederationForward(row, client)` → `{ row, inserted }`; row in-keys `{messageId,idempotencyKey,recipientDomain,originDomain,envelope,senderKey,senderOwnerId,now}` | T14 `enqueueForward` calls it with exactly those keys (brief code block) | MATCH. `duplicate: !inserted` maps to T13 conflict-return `{row:existing,inserted:false}`. |
| T13 → T15 | `claimDueFederationForwards(now,limit,leaseSeconds,client)`, `finalizeFederationForward(id,token,state,{attemptCount,nextAttemptAt,reasonCode},client)`, existing `getPeerByDomain`, `withTransaction`, `recordAuditEvent` | T15 reaper consumes all five; `rowToFederationOutboxRecord` camelCase `{envelope,senderKey,senderOwnerId,attemptCount,claimToken,...}` feeds `buildForwardRequest` + finalize | MATCH. Row camelCase keys align with T15 step-2 usage. |
| T15 → T16 | `startFederationReaper({repository,identity,originDomain,intervalMs,fetchImpl})` → unref'd setInterval handle | T16 calls `startFederationReaper({repository, identity: federationIdentity, originDomain: relayDomain})` | MATCH. `federationIdentity` is the loaded identity object also passed to `signForwardRequest` on the T11 sync path — consistent. |
| T13 → T17 (Batch 6, out of scope) | `listFederationOutbox`, `getFederationOutboxRow`, `retryFederationForward` | T17 CLI `federation outbox list|show|retry` | T13 must still PRODUCE all three this batch (brief Interfaces lists them). Not reviewed against a consumer this batch. |
| T14 R12 forward-ref | `enqueueForward` now defined in accept-envelope.mjs | T11 `forwardEnvelope` queue branch `return enqueueForward(...) // Task 14` at accept-envelope.mjs:223 | Call-site args `(envelope, route, options, client, { senderKey, senderOwnerId })` EXACTLY match T14 brief signature. R12 forward-ref goes live. |

Per-task self-consistency:
| Task | Check | Finding |
|---|---|---|
| T13 | test guard env var | CONFLICT: brief Step 1 says guard on `SIGIL_DATABASE_URL` "mirroring postgres-repository.peer.test.mjs", but that file (`:12`) and `accept-federated-envelope.pg.test.mjs` (`:14`) both key off `SIGIL_TEST_DATABASE_URL`; CI live-DB matrix sets `SIGIL_TEST_DATABASE_URL`. → Ruling R14. |
| T13 | claim SQL `attempt_count + CASE WHEN state='processing' THEN 1 ELSE 0 END` vs T15 reaper also incrementing | Not a self-contradiction: claim bumps only on lease-steal reclaim (processing→processing); first pending→processing claim leaves count at 0, reaper computes `row.attemptCount + 1` and persists via finalize `attemptCount`. Crash-after-claim path can double-count (lease-steal bump + reaper bump) — inherent to plan design, both mechanisms brief-mandated. Watch item for T15 reviewer, not a blocker. |
| T14 | in-memory repo + queue | brief: not exercised here; `createMemoryRepository` gets no outbox methods; startup abort (T16) is the guard. Consistent. |
| T15 | unpinned peer at reap time | brief: `getPeerByDomain(row.recipientDomain)` null → treat as transport-failure/backoff path. Implementer guidance, self-consistent. |
| T16 | error-string change | brief mandates changing T12's `--federation-mode queue requires --database-url (or SIGIL_DATABASE_URL)` to append `; in-memory relays have no durable outbox`. The T12 test `relay-up-federation.test.mjs:35` regex `/--federation-mode queue requires --database-url/` still matches the new string (prefix unchanged) — no T12 test breakage. Plan-mandated edit; reviewer told so. |

### Rulings (Batch 5)
- **R14 (T13, T14):** the new live-DB test files (`postgres-repository.federation-outbox.test.mjs`, `accept-envelope.federation-queue.test.mjs`) guard AND take their connection string from `process.env.SIGIL_TEST_DATABASE_URL`, not `SIGIL_DATABASE_URL`. Why: brief Step 1 says "mirroring postgres-repository.peer.test.mjs" and that file uses `SIGIL_TEST_DATABASE_URL`; every pg/federation test in the repo uses it; the CI live-DB job sets it; the brief's `SIGIL_DATABASE_URL=$SIGIL_TEST_DATABASE_URL node --test` run line reflects that the app *runtime* reads `SIGIL_DATABASE_URL` while the test *guard* reads `SIGIL_TEST_DATABASE_URL`. Cost if wrong: the two files skip in CI (env-name mismatch), leaving the R10 Postgres path unverified one more batch; visible as SKIP in CI logs, one-line guard fix.

### Models
- T13 → sonnet (multi-method PG + concurrency test, integration judgment). Reviewer sonnet.
- T14 → haiku (one function, full code in brief). Reviewer sonnet.
- T15 → sonnet (new module, retry/backoff state machine). Reviewer sonnet.
- T16 → haiku (small CLI wiring + 1 test). Reviewer sonnet.

### Task 13 — federation_outbox repository methods (Postgres)
- Brief: task-13-brief.md. Dispatch carried R14 (test guard `SIGIL_TEST_DATABASE_URL` not `SIGIL_DATABASE_URL`) + migration-017-already-applied + method-style anchors (claimDelivery ~423, upsertPeer ~981).
- Implementer: sonnet, agent a74cca5e0718be583 (resume for fix rounds 1-3). Status DONE_WITH_CONCERNS, commit f944687. Implementer HAD a live PG DB: new postgres-repository.federation-outbox.test.mjs 10/10 pass (RED: all 10 `TypeError: not a function`). `npm test` 797 / 718 pass / 1 fail / 78 skip — the 1 fail = `sigil/scripts/live-ollama-worker-test.mjs` (`fetch failed`), matches Batch 4 ledger's proven-pre-existing live-ollama fail. Concerns: `::timestamptz`/`::double precision` casts added to bound params; claim SET has no `updated_at` bump (brief-verbatim); postgres-repository.mjs ~1160 lines, not refactored.
- Review package: review-bab39b2..f944687.diff (1 commit, 19142 bytes).
- Reviewer: sonnet, agent ac0d34d1bd15416c4. Fed R14 + 6 named risks (claim SQL verbatim + cast correctness, ownership guard, retry expiry-first + state gate, enqueue ON CONFLICT re-SELECT, concurrency test is real, memory repo untouched).
- Task 13 review: Spec ✅ compliant, Task quality APPROVED. All 6 risks CLEAR: claim SQL brief-verbatim, `$1::timestamptz`/`$2::double precision` casts correct + behavior-preserving (pg binds params as unknown/text; make_interval + timestamptz arithmetic need concrete types; ISO string casts to same instant); CASE reads pre-update row so re-claims increment, fresh pending claims do not; ownership guard `WHERE id=$1 AND claim_token=$2` returns `{updated: rowCount>0}`; retryFederationForward gates `IN ('forward_rejected','dead_letter')` + expiry short-circuit no-write; enqueue `ON CONFLICT (message_id, idempotency_key) DO NOTHING RETURNING *` + 0-row re-SELECT → `{row: existing, inserted: false}`; concurrency test genuine (6 rows, two `withTransaction` claims in `Promise.all`, asserts disjoint id sets); diff touches only postgres-repository.mjs + new test. `rowToFederationOutboxRecord` maps all 16 camelCase fields; listFederationOutbox omits envelope/sender_key (SELECT + destructure), getFederationOutboxRow full row.
- Task 13: minor (deferred → Task 19): enqueueFederationForward binds `created_at`/`updated_at` from caller `now` (`VALUES ... $8,$8,$8`) not DB `now()` — a backdated logical `now` in prod would backdate audit timestamps too. Consider defaulting created_at/updated_at to DB now(), binding only next_attempt_at.
- Task 13: minor (deferred → Task 19): claimDueFederationForwards SET has no `updated_at` bump (brief-verbatim); a reaper reading updated_at for staleness sees stale value on re-claimed rows until finalize runs.
- Task 13: complete (commits bab39b2..f944687, review clean)

### Task 14 — queue-mode enqueue in acceptWithRepository
BASE for Task 14 = f94468725de99aa2c079d39502138b4f68273b45
- Brief: task-14-brief.md (full `enqueueForward` code in brief). Dispatch carried: queue branch call-site already in place (accept-envelope.mjs:222 from Task 11); `repository.enqueueFederationForward` from Task 13; use existing `recordFederationAudit` helper; R14 test guard = `SIGIL_TEST_DATABASE_URL`.
- Implementer: haiku, agent a0103db61a43fb357. Status DONE, commit a2e6fc5.
- Review package: review-f944687..a2e6fc5.diff. Reviewer: sonnet, agent abb7227af855643ef.
- Task 14 review R0: Spec ❌. `enqueueForward` impl brief-verbatim + correct (risks 1,2,3,5 PASS), but the sole deliverable test `accept-envelope.federation-queue.test.mjs` would FAIL against a live DB. Critical: test never `upsertPeer`s the recipient peer → `decideRoute` returns PEER_NOT_PINNED → accept 400 → first `assert 202` fails, `enqueueForward` never reached. Important: not hermetic (no schema reset / outbox cleanup). Important: duplicate subtest asserted relative `=== countBefore` not absolute "still one row". Minor: dead test code (PEER_B, unused locals). Minor (deferred → Task 19): `recordFederationAudit` maps `federation.queued` → `outcome:'rejected'` (`endsWith('forwarded')` is the only success test) — pre-existing helper, this task newly exercises it.
- Fix round 1/5 (resume a0103db61a43fb357): commit 366c721. Re-review (sonnet, a8225edf22b49faed): findings 1 (upsertPeer b.example, kid=federationIdentity.key_id, pubkey base64url DER SPKI), 2 (DROP/CREATE SCHEMA + real migration re-run), 4 (dead code) ADDRESSED. Finding 3 NOT ADDRESSED + NEW Important breakage: `counts.pending` is table-wide; subtest 1's row persists so subtest 2's `=== 1` is really 2 → guaranteed live-DB failure.
- Fix round 2/5 (resume a0103db61a43fb357): commit 3517b60 — `DELETE FROM federation_outbox` at start of each subtest, all three `counts.pending` checks absolute `=== 1`, duplicate subtest still asserts `duplicate:true`. Re-review (sonnet, a57f8b08e04216320): finding ADDRESSED, no new breakage, diff +14/-4 one test file, no production code touched.
- Task 14: fix round 1/5 (3 addressed, 1 open — duplicate absolute-count; commits a2e6fc5..366c721); fix round 2/5 (1 addressed, 0 open; commits 366c721..3517b60)
- Task 14: complete (commits f944687..3517b60, review clean)
- CARRY-FORWARD: Task 13 + Task 14 live-DB tests (`postgres-repository.federation-outbox.test.mjs`, `accept-envelope.federation-queue.test.mjs`) SKIP locally — CI live-DB matrix (SIGIL_TEST_DATABASE_URL) is first real execution. Same open item as R10.

### Task 15 — federation reaper pass + driver
BASE for Task 15 = 3517b604eab870646eae18f8fbe4a66f223c1755
- Brief: task-15-brief.md. Dispatch (sonnet) carried: full consumed-API sigs (buildForwardRequest → {body,canonicalBytes}; postForward return/throw contract; claim SQL increments attempt_count only on lease-expired re-claim so reaper owns the +1); interval-driver pattern from startOidcIssuerAllowlistPolling (sigil.mjs:134); exact backoff [60000,300000,1800000] + `>=3` dead-letter; null-peer → transport-failure branch.
- Implementer #1: sonnet, agent a42bcc82b7327b3df — built both files, focused test 8/8 GREEN, wrote report, but session ENDED before `npm test`/commit (files left untracked). Agent ID unrecoverable.
- Implementer #2 (finish): haiku, agent a63503f9d0962c5ce — ran focused test (8/8), `npm test` 806 / 727 pass / 0 fail / 79 skip (live-ollama skipped this run), filled report's RESULT-PENDING line, committed 18c16cd (2 files exactly).
- Review package: review-3517b60..18c16cd.diff (1 commit, 20142 bytes). Reviewer: sonnet, agent a799513f77f1e0c40. Fed global constraints + 9 named risks.
- Task 15 review: Spec ✅ compliant, Task quality APPROVED. All 9 risks CLEAR: (1) claim is own `withTransaction`, resolves before the for-loop, no HTTP inside; (2) `BACKOFF_MS=[60_000,300_000,1_800_000]`, `MAX_ATTEMPTS=3`, `nextAttemptCount=row.attemptCount+1`, `>=3`→dead_letter else `now+BACKOFF_MS[nextAttemptCount-1]` — exact; (3) `finalize()` helper wraps every state write in `withTransaction((c)=>finalizeFederationForward(row.id,row.claimToken,state,patch,c))`, `if(updated)` gates every counter/audit; (4) 4xx `ok:false`→`forward_rejected` terminal, `reasonCode=outcome.peerCode??null`, audit `federation.forward_rejected`; (5) `Date.parse(row.envelope?.expires_at)<=nowMs` FIRST per row (before buildForwardRequest)→dead_letter/MESSAGE_EXPIRED, no forward; (6) 5 recordAuditEvent calls, payloads only `reason_code`/`peer_code`/`attempt_count`/`peer_status`, no body (test 1 asserts `expires_at` absent); (7) `startFederationReaper` = `setInterval(async…try/catch console.error…).unref()`, no rethrow/clearInterval; (8) fake repo is real state store (Map mutate + claimToken-mismatch reject), 3-transport-failures runs 3 real passes advancing `now` asserting +60s/+300s/dead_letter + 4th pass claimed:0; (9) fake claim leaves attemptCount untouched on fresh claim, reaper owns +1, no double-count. Reaper doesn't re-implement fetch (delegates to postForward), no hand-rolled canon.
  - ⚠️ controller-verify: `buildForwardRequest`/`signForwardRequest` return shapes not in diff — test exercises both for real (ed25519 keygen+sign, `signed.keyId` flows to postForward) and passes → effectively confirmed. RESOLVED: sigs match Task 11 sync path + federation-router.mjs source read at dispatch time.
- **Ruling R15 (T15, plan-mandated finding):** the reviewer's one Important finding — `buildForwardRequest`/`signForwardRequest` unguarded, so a poison row (malformed stored envelope / bad identity key) throws out of the whole pass and wedges the batch behind it (throw precedes any `finalize`, so lease-expiry never routes it to dead_letter) — is ACCEPTED as a documented limitation for Batch 5. Why: brief Step 2 explicitly lists no build/sign error handling; trigger conditions are near-impossible in practice (enqueue stores the exact envelope that passed accept validation; bad identity is caught by the Task 12 startup guard); not load-bearing for Tasks 16-19. Deferred follow-up folded into Task 19: wrap per-row build+sign in try/catch → ownership-guarded `finalize(row,'dead_letter',{reasonCode:'FORWARD_BUILD_FAILED'})` + audit, then continue. Cost if wrong: a real poison row in prod queue mode wedges ALL federated forwarding until an operator deletes the row via direct SQL (no CLI delete yet); visible in reaper `console.error` every 60s; recoverable, no data loss.
- Task 15: minor (deferred → Task 19): federation-reaper.mjs ~200 `error.message` on a non-Error throw logs `undefined` — use `error?.message ?? error`.
- Task 15: minor (deferred → Task 19): test fake `claimDueFederationForwards` doesn't model Task 13's lease-expired re-claim `attempt_count` bump; no tested path leaves a row `processing`, so a future re-claim-dependent test could false-pass.
- Task 15: minor (noted, no action): null-peer tagged `reasonCode:'PEER_NOT_PINNED'` vs thrown `'FORWARD_TRANSPORT_FAILED'` — additive, same transitions/counts, better operator triage; a 3-pass unpinned peer dead_letters with `reason_code:'PEER_NOT_PINNED'` (brief's "or null peer" in the `>=3` rule).
- Task 15: complete (commits 3517b60..18c16cd, review clean)

### Task 16 — wire reaper into `sigil relay up` (queue mode)
BASE for Task 16 = 18c16cd (Task 15 HEAD)
- NOTE: Task 16 was implemented + committed (719d62c) + reported (task-16-report.md, 18:44) by an implementer dispatched in the prior session whose result notification was never seen before session end. Ledger had no Task 16 entry; not pushed (origin still bab39b2). This session picked it up at review.
- Implementer: (prior-session agent, id unrecorded). Status per report: DONE. Diff = +6 lines in sigil.mjs (1-line error-string suffix + 6-line queue-mode reaper start block after `server.listen()`), +12 lines one new test in relay-up-federation.test.mjs. relay-up-federation 6/6; regression + relay-up-domain 10/10; `npm test` 727 pass / 1 known live-ollama fail / 79 skip.
- Review package: review-18c16cd..719d62c.diff (1 commit, 5705 bytes). Reviewer: sonnet, agent ac95d1e098fe115f1. Fed global constraints + 6 named risks.
- Task 16 review: Spec ✅ compliant, Task quality APPROVED. All 6 risks CLEAR: (1) reaper-start block at sigil.mjs:237-242, after `server.listen()` + `server.address()`, guarded `federationMode==='queue'` only, byte-matches brief code block (`identity: federationIdentity`, `originDomain: relayDomain`, dynamic `import('../relay/v1/federation-reaper.mjs')`, the console.log); reaching it in queue mode guarantees databaseUrl set (line 173 aborts otherwise) so `repository` is the PG repo; (2) sigil.mjs:173 error string = Task 12 string + exact suffix `; in-memory relays have no durable outbox`, prefix unchanged; (3) Task 12 test relay-up-federation.test.mjs:35 regex `/--federation-mode queue requires --database-url/` still matches new longer string — no breakage; (4) new test shells `sigil init a --domain local` + `runRelayUp` queue/no-db, `assert.throws` on `/in-memory relays have no durable outbox/`, `finally` tmpdir cleanup, pre-bind abort no port opened, `--domain local` matches sibling-test convention; (5) no positive "reaper starts" assertion — correctly deferred to CI Postgres startup integration test; (6) additive, only sigil.mjs + relay-up-federation.test.mjs touched, cmdRelayUp not restructured.
- Task 16: minor (deferred → Task 19): brief Step 1 parenthetical asked for a `// TODO:` breadcrumb in the test file pointing at the deferred CI-Postgres positive-path "reaper starts" coverage; not added. Report misread "TODO noted in brief" as satisfying it. Add `// TODO: positive "reaper starts" coverage requires live Postgres + process management — see CI Postgres startup integration test.` near the new test.
- Task 16: complete (commits 18c16cd..719d62c, review clean)

===================================================================
## BATCH 5 FINISHED — clean. Branch stays OPEN for Batch 6.
===================================================================
Branch feat/federation-inter-relay-routing @ 719d62c (19 commits ahead of sigil-repo main 7c2e867; 6 new this batch, of which 3 are Task 14 fix commits):
  f944687  Task 13  federation_outbox repository methods (enqueue/claim/finalize/list/retry)
  a2e6fc5  Task 14  queue-mode federation_outbox enqueue on accept
  366c721  Task 14  fix(test): hermetic schema reset + peer registration
  3517b60  Task 14  fix(test): per-subtest federation_outbox cleanup
  18c16cd  Task 15  federation reaper pass + interval driver
  719d62c  Task 16  start federation outbox reaper for queue-mode relays
Task 13: review clean, no fix loops (2 minors deferred). Task 14: review ❌ R0 (broken test), 2 fix rounds → clean. Task 15: review clean + R15 (poison-row deferred). Task 16: review clean (1 minor deferred).
NO batch-end whole-branch review (plan line ~1933 — only after Task 19). Per-task reviews only.

### CARRY-FORWARD to Batch 6
- Tasks 13, 14 live-DB tests (`postgres-repository.federation-outbox.test.mjs`, `accept-envelope.federation-queue.test.mjs`) SKIP locally — CI live-DB matrix (SIGIL_TEST_DATABASE_URL) is first real execution of the Task 13/14 Postgres path. Same open item class as R10 (Batch 3). If CI live-DB red after push, look at: migration 017 (federation_outbox schema + the CHECK constraints), the claim SQL `::timestamptz`/`::double precision` casts, `ON CONFLICT (message_id, idempotency_key)` re-SELECT.
- Task 17 (Batch 6) consumes Task 13's `listFederationOutbox`, `getFederationOutboxRow`, `retryFederationForward` — produced this batch, NOT yet reviewed against a consumer.
- Batch 6 = Tasks 17-19 (`sigil federation outbox list|show|retry` CLI, `sigil route test`, close-out) + the plan's ONLY whole-branch final review runs after Task 19.

### Rulings made (Batch 5) — for the finish list
- **R14 (T13, T14):** new live-DB test files guard AND take connection string from `process.env.SIGIL_TEST_DATABASE_URL`, not `SIGIL_DATABASE_URL` (brief said the latter). Why: brief says "mirror postgres-repository.peer.test.mjs" which uses `SIGIL_TEST_DATABASE_URL`; all repo pg/federation tests + CI live-DB job use it. Cost if wrong: the 2 files SKIP in CI (env-name mismatch), R10-class Postgres path unverified another batch; one-line guard fix, visible as SKIP in CI logs.
- **R15 (T15, plan-mandated finding):** reviewer's Important finding — unguarded `buildForwardRequest`/`signForwardRequest` in the reaper lets a poison row (malformed stored envelope / bad identity) throw out of the whole pass and wedge the batch behind it — ACCEPTED as documented limitation for Batch 5. Why: brief Step 2 lists no build/sign error handling; triggers near-impossible in practice (enqueue stores the validated envelope; bad identity caught by Task 12 startup guard); not load-bearing for Tasks 16-19. Deferred fix folded into Task 19 (wrap per-row build+sign in try/catch → dead_letter `FORWARD_BUILD_FAILED` + audit). Cost if wrong: a real poison row in prod queue mode wedges ALL federated forwarding until an operator deletes the row via direct SQL (no CLI delete); visible in reaper `console.error` every 60s; recoverable, no data loss.

### Deferred minors from Batch 5 (fold into Task 19 docs/cleanup pass)
- postgres-repository.mjs enqueueFederationForward (T13): binds `created_at`/`updated_at` from caller `now` (`VALUES … $8,$8,$8`) not DB `now()` — a backdated logical `now` in prod would backdate audit timestamps too.
- postgres-repository.mjs claimDueFederationForwards (T13): SET has no `updated_at` bump (brief-verbatim); a reaper reading updated_at for staleness sees stale value on re-claimed rows until finalize.
- accept-envelope.mjs recordFederationAudit (T14): maps `federation.queued` → `outcome:'rejected'` (`endsWith('forwarded')` is the only success test) — pre-existing helper, T14 newly exercises it.
- federation-reaper.mjs ~200 (T15): `error.message` on a non-Error throw logs `undefined` — use `error?.message ?? error`.
- federation-reaper.test.mjs (T15): fake `claimDueFederationForwards` doesn't model the lease-expired re-claim `attempt_count` bump; a future re-claim-dependent test could false-pass.
- relay-up-federation.test.mjs (T16): missing `// TODO:` breadcrumb for the deferred CI-Postgres positive "reaper starts" coverage.
- (carried from Batch 4, still open) accept-envelope.mjs ~258-259, :259, ~285, ~180-181 T11 items; relay-up-federation positive-path + doubled `sigil: sigil relay up:` prefix T12 items.

PUSHED 2026-08-31 to origin/feat/federation-inter-relay-routing (bab39b2..719d62c; local == origin == 719d62c). Pre-push gate green: 807 tests / 728 pass / 0 fail / 79 skip, "Pre-push verification passed." live-ollama-worker-test.mjs PASSED this run (689s). Workspace + ledger RETAINED for Batch 6.

### Batch 6 start checklist (fresh session)
1. Preflight: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing (expect branch feat/federation-inter-relay-routing, HEAD 719d62c).
2. Re-run superpowers:subagent-driven-development. Tasks with `Task N: complete` are DONE (1-16). Resume at Task 17.
3. Conflict scan for Tasks 17-19: Task 17 (`sigil federation outbox list|show|retry` CLI) consumes Task 13's `listFederationOutbox` / `getFederationOutboxRow` / `retryFederationForward` — produced but not yet consumer-reviewed. Task 18 = `sigil route test` (read-only, sends nothing). Task 19 = close-out (docs/CHANGELOG + fold in ALL deferred minors + R15 poison-row fix).
4. Batch 6 IS the last batch → the plan's ONLY whole-branch final review runs after Task 19 (plan line ~1933). Dispatch on most capable model. Point it at the deferred-minor + parked/ruling lines in this ledger.
5. R10 + R14 live-DB paths: CI live-DB matrix is still the first real execution of the whole federation Postgres path (registerFederatedSender, migration 017, federation_outbox claim/finalize/retry). If CI live-DB red, look there first.

===================================================================
## Session 6 (2026-08-31) — Batch 6 (Tasks 17-19: CLI + close-out). LAST BATCH.
===================================================================
- Preflight: verify-repo-context.ps1 -Path <worktree> => PASS, branch feat/federation-inter-relay-routing. HEAD 719d62c == origin == ledger Batch 5 finish line.
- Batch scope: Tasks 17, 18, 19. After Task 19 → the plan's ONLY whole-branch final review (most capable model), then finishing-a-development-branch.
- Models: T17 sonnet (CLI + live-DB test + first consumer of 3 unreviewed Task-13 repo methods), T18 sonnet (multi-step diagnostic, http stub server), T19 sonnet (regression-suite design + docs). Reviewers sonnet.

### Pre-execution conflict scan (Batch 6)

#### Consumed-interface existence check (all at HEAD 719d62c)
| Symbol | Source | Line | Used by | Finding |
|---|---|---|---|---|
| withRepository(args, requireMsg, fn, {migrate}) | sigil/cli/sigil.mjs | 372 | T17 | PRESENT. `{ migrate: true }` supported. |
| listFederationOutbox({states}) → `{counts, rows}` | sigil/relay/v1/postgres-repository.mjs | 1110 | T17 | PRESENT. counts keys pending/processing/forwarded/forward_rejected/dead_letter; rows strip envelope+senderKey; row fields include id/state/recipient_domain/attempt_count/next_attempt_at/last_reason_code (all plan-table cols). |
| getFederationOutboxRow(id) → full record or null | postgres-repository.mjs | 1132 | T17 | PRESENT. Returns FULL row incl `envelope` — T17 `show` MUST NOT print envelope body. |
| retryFederationForward(id, now=new Date(), client) | postgres-repository.mjs | 1136 | T17 | PRESENT. Returns `{retried:true}` on success; `{retried:false}` (row missing OR state not in forward_rejected/dead_letter); `{retried:false, reason:'MESSAGE_EXPIRED'}` (expired). Plan only specifies success + MESSAGE_EXPIRED branches — see self-consistency T17. |
| getPeerByDomain(domain) | memory-repository.mjs:313 / postgres-repository.mjs | - | T18 | PRESENT (both repos). |
| checkRelayConnectivity(relayUrl, {timeoutMs,fetchImpl}) → `{ok,latencyMs,error}` | sigil/cli/doctor.mjs | 52 | T18 | PRESENT + EXPORTED. Reuse directly instead of re-implementing the plan's "doctor.mjs:47-70 probe pattern". |
| loadIdentity, parseFederatedId | sigil/cli/identity.mjs, federated-id.mjs | - | T18 | PRESENT (used across the branch already). |
| dispatch chain | sigil/cli/sigil.mjs | 687-705 | T17, T18 | `const [command, sub, ...rest] = process.argv.slice(2)` @685; flat `if/else if` chain @687-704 ending `else usage()` @705. Plan says "near line 729"/"switch chain" — STALE ANCHOR (drift only). Add `else if (command === 'federation') await cmdFederation(process.argv.slice(3));` and `else if (command === 'route') await cmdRoute(process.argv.slice(3));` before `else usage()`. |

#### Cross-task table (Batch 6 = Tasks 17-19)
| Pair | Shared file / interface | Producer → Consumer | Finding |
|---|---|---|---|
| T17 × T18 | sigil/cli/sigil.mjs (cmdFederation vs cmdRoute; two new dispatch branches; usage text) | T17 adds `federation` branch + cmdFederation; T18 adds `route` branch + cmdRoute | CLEAN — sequential append, disjoint functions, distinct command literals. |
| T17 × T19 | none | - | CLEAN — T19 touches only STATUS.md, CHANGELOG.md, new federation-regression.test.mjs. |
| T18 × T19 | none | - | CLEAN. |
| T13 → T17 | listFederationOutbox / getFederationOutboxRow / retryFederationForward | produced Batch 5 (f944687), first consumer here | MATCH (shapes verified above). Gaps: `show` must not print `envelope`; `retry` `{retried:false}` no-reason branch unspecified by plan — Ruling R18. |
| T15/T16 reaper → T19 regression | runFederationReaperPass / decideRoute no-federationMode path | T19 test 1-2 assert `RECIPIENT_NOT_LOCAL` / 202 on a no-`federationMode` relay | CLEAN — decideRoute legacy-path equivalence already verified Batch 4 (Task 11 review); T19 just pins it. |

#### Self-consistency table
| Task | Own text checked | Finding |
|---|---|---|
| T17 | Step 1 test "skip without `SIGIL_DATABASE_URL`" vs repo convention (`SIGIL_TEST_DATABASE_URL` guards every pg/federation test: postgres-repository.peer.test.mjs:12, accept-federated-envelope.pg.test.mjs:14, Batch-5 R14 files; CI live-DB job sets `SIGIL_TEST_DATABASE_URL`) | CONFLICT — identical class to Batch 5 R14 / Batch 1 R2. → Ruling R16. |
| T17 | Step 3 `retry` output: plan gives `Re-queued <id>` (success) + expired-message/non-zero (`reason:'MESSAGE_EXPIRED'`). Actual `retryFederationForward` also returns bare `{retried:false}` for missing-id / wrong-state. | GAP — plan omits this branch. → Ruling R18. |
| T17 | Step 3 `show <id>` "one row's metadata + transition history ... no envelope body" vs `getFederationOutboxRow` returning full record incl `envelope` | OK as spec, but implementer MUST destructure/omit `envelope` (+ `senderKey`) before printing. Impl-time note, folded into brief. |
| T18 | Step 1 test seeds identity via `sigil init` (per sibling CLI tests) → `cmdInit` runs real DNS `resolveDomainOrThrow` for every non-`local` host (sigil.mjs:95); RFC 2606 `a.example` never resolves | CONFLICT — identical class to Batch 1 R2 / Batch 4 R13. → Ruling R17. |
| T18 | Step 1(c) "seed via `sigil peer add` against `--database-url` test DB, or skip when unset" — which env var? | Use `SIGIL_TEST_DATABASE_URL` (same as R16). Folded into R17 note. Non-DB sub-cases (a)(b) always run. |
| T18 | read-only, "sends no envelope" — test asserts stub server received only `GET /v1/health` | OK — `checkRelayConnectivity` only GETs `/v1/health`; no POST path in cmdRoute. Self-consistent. |
| T19 | regression tests call `acceptEnvelopeAsync({ relayDomain: 'a.example' })` in-process (no CLI, no `sigil init`) | OK — validate-envelope / accept-envelope never DNS-resolve `relayDomain`; Batch 3+ federation tests already use `a.example`/`b.example` as in-process relay domains. No R2-class issue here. |
| T19 | Step 6 "check every box in this plan file" — plan lives at `C:\dev\docs\...` (the `c:\Dev` repo, branch `spec/sigil-inter-relay-routing`), NOT in sigil-repo worktree | Box-checking is bookkeeping in a DIFFERENT repo; Task 19's commit (`git add`) only lists sigil-repo files. → Ruling R19: check the boxes (edit the plan doc in place) but do NOT attempt to commit it inside sigil-repo; leave the `c:\Dev` repo change for that repo's own management. |
| T19 | Step 7 `git push` + `gh pr create` | Branch already shared/pushed (Batches 4-5 pushed to origin/feat/federation-inter-relay-routing); a Task-19 push to the SAME branch matches established plan pattern. PR creation deferred to `finishing-a-development-branch` (SDD finish overrides plan Step 7). → Ruling R20. |

### Rulings (pre-execution, Batch 6)
- **R16 (T17):** the new live-DB CLI test (`sigil/cli/sigil-federation-outbox.test.mjs`) guards on `process.env.SIGIL_TEST_DATABASE_URL` (skip when absent) and passes that value to the shelled-out CLI as `--database-url` (or via child env `SIGIL_DATABASE_URL`). Plan Step 1 says "skip without `SIGIL_DATABASE_URL`" but every pg/federation test in the repo + the CI live-DB job key off `SIGIL_TEST_DATABASE_URL`; the app runtime reads `SIGIL_DATABASE_URL`. Mirrors R14 / R2. — Cost if wrong: the file SKIPs in CI (env-name mismatch), leaving the Task-13 list/show/retry Postgres path unverified through merge; visible as SKIP in CI logs, one-line guard fix.
- **R17 (T18):** Task 18's test uses `sigil init <name> --domain local` for identity setup (not `--domain a.example`); the DB-backed sub-case (c) guards on and uses `process.env.SIGIL_TEST_DATABASE_URL`. `cmdInit` runs a real DNS `resolveDomainOrThrow` for every non-`local` host and RFC 2606 `a.example` never resolves, so an `a.example` setup throws before any assertion. `local` skips DNS and still exercises parseFederatedId / peer-directory / reachability. Mirrors R2 / R13. — Cost if wrong: test-only domain-literal churn in one new file, visible in diff.
- **R18 (T17):** `cmdFederation`'s `retry` handler treats the bare `{ retried: false }` return (id not found, or row not in `forward_rejected`/`dead_letter`) as a non-zero-exit error printing `Cannot retry <id>: not in a retryable state (only forward_rejected / dead_letter rows can be re-queued).` — distinct from the plan-specified `MESSAGE_EXPIRED` message. The plan enumerates only the success and expired branches; the third return exists in the shipped Task-13 code and must not fall through to a false "Re-queued". — Cost if wrong: one wording choice on an error path, visible in the test + diff, trivially reworded.
- **R19 (T19):** Task 19 Step 6 ("check every box in this plan file") is performed by editing the plan doc at `C:\dev\docs\superpowers\plans\2026-08-30-sigil-inter-relay-routing.md` in place, but that file is in the `c:\Dev` repo, not the sigil-repo worktree — it is NOT added to Task 19's sigil-repo commit and its own repo's staging is left for that repo's management. — Cost if wrong: the box-ticks sit as an uncommitted diff in the `c:\Dev` repo until someone commits or reverts them; cosmetic, no code impact.
- **R20 (T19):** Task 19 Step 7 (`git push` + `gh pr create`) is NOT run as part of Task 19. Task 19 ends at its commit. The push + PR/merge decision is handled once, after the final whole-branch review, by `superpowers:finishing-a-development-branch` (the SDD finish step, which overrides the plan's inline Step 7). — Cost if wrong: none material — the branch simply isn't pushed/PR'd a step earlier; the finish skill covers it.

### Progress (Batch 6)
BASE for Task 17 = 719d62cf65436f63a1ffe1879cf6247c3716c874

### Task 17 — sigil federation outbox list|show|retry
- Brief: task-17-brief.md. Implementer dispatched: sonnet, agent ad4d2254e1c4abdd2 (resume for fix rounds 1-3). Dispatch carried: verified shapes of listFederationOutbox/getFederationOutboxRow/retryFederationForward; withRepository @372 not 414; dispatch chain @687-705 flat if/else-if not "line 729 switch"; R16 (test guard SIGIL_TEST_DATABASE_URL) + R18 (bare `{retried:false}` → non-zero "not in a retryable state"); reuse cmdPeerList table style; no new repo method for audit history (DONE_WITH_CONCERNS if needed).
- Implementer: DONE_WITH_CONCERNS, commit a916cd9. npm test 808 total / 727 pass / 80 skip (incl new live-DB test — skipped locally, CI runs it) / 1 pre-existing live-ollama env fail. Non-DB paths verified directly (bad subcommand / missing id / missing --database-url all exit 1). Concerns: (1) `show` prints `Transition history: (unavailable)` — no repo method reads audit-by-message-id, adding one = scope creep; (2) live-DB test unverified locally.
- Review package: review-719d62c..a916cd9.diff (1 commit, 14040 bytes). Reviewer dispatched: sonnet, agent a783d144b6fddcdd1. Fed R16/R18 + stale-anchor note + 6 named risks (no-body in show/list, R18 branch distinct+non-zero, dispatch placement, R16 guard var, require-msg wording).
- Task 17 review: Spec ✅ compliant, Task quality APPROVED. All 3 controller rulings verified: R16 (`sigil-federation-outbox.test.mjs:31/47` guards `SIGIL_TEST_DATABASE_URL`, passes it via `--database-url` + forces flag path with child env `SIGIL_DATABASE_URL:''`; `sigil/scripts/live-db-tests.mjs:20` auto-discovers the file by the literal env-var string → CI live-DB gate runs it); R18 (`sigil.mjs:204-209` bare `{retried:false}` → verbatim "not in a retryable state" msg + `process.exitCode=1`; test covers all 3 return branches); stale-anchor (dispatch `else if` at `sigil.mjs:234` before `else usage()`, sibling style). No-body guarantee load-bearing + correct on both `list` (`sigil.mjs:173-175`) and `show` (`sigil.mjs:191` destructure-strip of envelope+senderKey). Require-msg wording matches sibling `oidc-issuer`/`peer` pattern. No Critical/Important.
- Task 17 ⚠️ (resolved by controller): whether CI live-DB actually ran the seeded test green — not in diff scope; discovery wiring confirmed present. Same R10/R14/R16 carry-forward class (CI live-DB matrix first real execution). NOT a code gap. Carried to final review + CI watch.
- Task 17: minor (deferred → Task 19): `sigil.mjs:193` `show` prints `Transition history: (unavailable)` unconditionally — repo only exposes `listAuditEventsForConversation` (`postgres-repository.mjs:1038`) and outbox rows carry no conversation id; wiring the real history needs a new subject-keyed audit reader (out of the 3 brief-listed consumed interfaces). Either add `listAuditEventsForSubject(subjectId)` + render, or drop the literal `(unavailable)` placeholder line.
- Task 17: minor (deferred → Task 19): `sigil-federation-outbox.test.mjs:72-78` `list` assertions check only counts line + row id + body-absence; no assertion the `recipient_domain`/`attempt_count`/`next_attempt_at`/`last_reason_code` columns render a value (a future camelCase typo at `sigil.mjs:174` would pass silently). Add `assert` that `list.stdout` contains `b.example` and `PEER_4XX` for the seeded row.
- Task 17: minor (deferred → Task 19 / backlog): `sigil.mjs:192` `show` dumps whole `meta` incl internal `claimToken`/`claimedAt` — consistent with `peer get` full-JSON dump, not prohibited (only envelope bodies barred); marginal value in operator output, optional prune.
- Task 17: complete (commits 719d62c..a916cd9, review clean)

### Task 18 — sigil route test (read-only federation diagnostic)
BASE for Task 18 = a916cd90f73b250571162a81c5885c9d25497932
- Brief: task-18-brief.md. Implementer dispatched: sonnet, agent a9b6f785c339faf12 (resume for fix rounds 1-3). Dispatch carried: dispatch chain flat if/else-if before `else usage()`; parseFederatedId is dynamic-imported (`await import('../relay/v1/federated-id.mjs')`); reuse EXPORTED `checkRelayConnectivity` from doctor.mjs (no hand-rolled probe); enter withRepository only when --database-url present, else every domain unpinned; step-4 advisory via toRegistryMap keyed by endpoint_id; R17 (test `sigil init --domain local` not a.example) + DB sub-case guards `SIGIL_TEST_DATABASE_URL`; stub http server records method+path, assert only `GET /v1/health` seen.
- Implementer: DONE, commit 3a09ee9. Focused test 2 pass / 1 skip (DB sub-case, SIGIL_TEST_DATABASE_URL unset — CI runs it). Full npm test 729 pass / 81 skip / 1 fail (pre-existing live-ollama env fail, diff touches only sigil.mjs + new test). Concerns: (1) `--relay-url` required per brief signature but unused — step 3 probes `peer.relayUrl` per brief step 3; (2) step-4 advisory only reachable on DB-gated pinned path, no local coverage.
- Review package: review-a916cd9..3a09ee9.diff (1 commit, 15206 bytes). Reviewer dispatched: sonnet, agent a9c29c72bb04bbc9d. Fed R17 + verbatim output strings + 9 named risks (no POST/read-only trace, `--relay-url` dead-param question, output strings + em-dash + trailing advisory, exit codes, checkRelayConnectivity reuse, stub-server GET-only assert, dynamic parseFederatedId import, --domain local, no-DB clean degrade).
- Task 18 review: Spec ✅ compliant, Task quality APPROVED. Read-only VERIFIED end-to-end (traced every outbound call in `cmdRoute` sigil.mjs:771-833 — parseFederatedId no-I/O, `getPeerByDomain` only w/o migrate, `checkRelayConnectivity` GET, step-4 local file reads; no POST/envelope/socket beyond health GET; stub asserts `seen` deep-equals `[]` unpinned / `['GET /v1/health']` DB test). `checkRelayConnectivity` reused via import from `./doctor.mjs` (5s bound holds). All mandated strings verbatim incl both U+2014 em-dashes (sigil.mjs:812/814). Exit codes correct (malformed→1, Pinned:no→1, success→0, Reachable:no does not fail). R17 followed (`init ... --domain local` test.mjs:51). No-DB path degrades cleanly (`if (databaseUrl)` guard sigil.mjs:781). Pre-existing live-ollama fail corroborated unrelated. No Critical/Important.
- Task 18 ⚠️ (resolved by controller → carried to final whole-branch review): `sigil.mjs:775-778` `--relay-url` parsed + made required but never read again (step 3 probes `peer.relayUrl`). Reviewer: this is a BRIEF/spec inconsistency, not an implementation miss — brief signature lists `--relay-url <url>` non-optional while Step 3 uses only the pinned peer URL, and making the flag the probe target would contradict Step 2's stop-at-unpinned. Kept required for `send`/`inbox` parity. Final review to decide: drop the flag from `route test`, or make it an explicit override of the pinned URL.
- Task 18: minor (deferred → Task 19): `sigil-route-test.test.mjs` — the two owner-id advisory branches (`would apply` / `would NOT apply — owner ids differ`) have zero coverage anywhere; even the DB-gated test only hits `not determinable locally`. Add a follow-up test seeding a registry entry to drive both owner-id outcomes.
- Task 18: minor (deferred → Task 19 / backlog): `sigil.mjs:782` the `withRepository` "unexpectedly missing" message is unreachable (call sits inside `if (databaseUrl)`); drop to a clearer assertion or comment.
- Task 18: complete (commits a916cd9..3a09ee9, review clean)

### Task 19 — regression sweep + docs + bounded deferred-minor cleanup
BASE for Task 19 = 3a09ee9e3a9e911f38f613ee2188d16a1d170017
- Brief: task-19-brief.md (plan Steps 1-6 only). Implementer dispatched: sonnet, agent a5c0ae7db5544470f (resume for fix rounds 1-3).
- Scope split into 2 commits:
  - **Part A** = plan Task 19 Steps 1-6: `federation-regression.test.mjs` (4 in-process `acceptEnvelopeAsync` tests, fixture COPIED verbatim from Task 3/11 test file), CHANGELOG entry (verbatim blockquote), STATUS.md, R19 (check plan-doc boxes in place, do NOT git-add — different repo), R20 (do NOT run Step 7 push/PR). Commit `test(relay): federation routing regression sweep + changelog/status`.
  - **Part B** = bounded cleanup, ruling-folded deferred minors ONLY: B1 = R15 poison-row guard (wrap `buildForwardRequest`+`signForwardRequest` in try/catch → ownership-guarded `dead_letter`/`FORWARD_BUILD_FAILED` + audit + continue; + new reaper test) in federation-reaper.mjs; B2 = reaper:183 `error?.message ?? error`; B3 = `sigil init` missing-`<name>` usage string names `--federation-owner` too; B4 = init-federation-owner.test.mjs test 5 add no-partial-write assert; B5 = federation-outbox `list` test assert column values render; B6 = delete `show` `Transition history: (unavailable)` placeholder line; B7 = cmdRoute unreachable withRepository message tidy. Commit `fix(federation): reaper poison-row dead-letter guard + close-out cleanup`.
- NOT folded into Task 19 (→ final whole-branch review triage): accept-envelope.mjs T11 minors (FORWARD_MISCONFIGURED defensive guard, recordFederationAudit outcome:'rejected' for queued/forward_unavailable, dead FORWARD_* statusByCode entries, build/sign-before-queue-check ordering); Task 18 `--relay-url` dead-param brief inconsistency; Task 18 owner-id advisory branch coverage; T13 created_at/updated_at-from-caller-`now` + claim no-updated_at-bump; T16 missing `// TODO:` breadcrumb; backlog notes (pgcrypto claim false, federation_outbox forwarded-row retention).
- Task 19 implementer (sonnet a5c0ae7db5544470f) dispatch #1 FAILED before any work: session rate limit (HTTP 429, resets 9:10pm America/New_York). No commits, no working-tree changes, no report. HEAD still 3a09ee9. Re-dispatch after reset.

===================================================================
## RESUME HERE (fresh session, after 9:10pm ET rate-limit reset) — Batch 6, Task 19
===================================================================
State: Tasks 1-18 COMPLETE + reviewed (all review-clean, no open Critical/Important). HEAD == 3a09ee9 == origin bab39b2..719d62c pushed; 17 (a916cd9) + 18 (3a09ee9) NOT yet pushed. Task 19 NOT started.
Next actions, in order:
1. Preflight: pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo\.worktrees\feat-federation-inter-relay-routing  (expect branch feat/federation-inter-relay-routing, HEAD 3a09ee9).
2. Re-dispatch Task 19 implementer (sonnet). The full dispatch brief content is captured above under "### Task 19" — Part A (plan Steps 1-6: federation-regression.test.mjs 4 tests + CHANGELOG verbatim blockquote + STATUS.md + R19 check-boxes-no-commit + R20 no-push) as commit 1; Part B (B1-B7 bounded cleanup, B1 = R15 poison-row guard in federation-reaper.mjs:68-74 + new test) as commit 2. task-19-brief.md = plan Steps 1-6 only. BASE for Task 19 = 3a09ee9.
3. Task 19 review (sonnet) — same loop. Point reviewer at: Part A regression tests assert real codes/statuses not vacuous; Part B is exactly B1-B7 nothing extra; B1 matches sibling dead_letter block shape + its test proves the pass no longer throws AND a following healthy row still forwards; R19/R20 honored.
4. FINAL whole-branch review (LAST batch). Pkg: scripts/review-package PLAN MERGE_BASE HEAD where MERGE_BASE = 7c2e867 (branch start) → HEAD. Dispatch code-reviewer.md on MOST CAPABLE model (opus). Point it at ALL "minor (deferred)" + "NOT folded into Task 19" lines in this ledger + the Batch 1-5 carry-forwards (R6/R10/R14/R16 live-DB-first-run status; R15 now fixed by B1 if Task 19 lands it). ONE fix wave max, one scoped re-review, adjudicate residuals.
5. Finish: collect every `R1..R20` ruling line into final message under "Rulings I made" (order made, each w/ cost-if-wrong). Delete workspace. superpowers:finishing-a-development-branch (handles the push of 17/18/19 + PR decision — R20).
Implementer agent id from failed dispatch (do NOT resume — it did nothing; start fresh): a5c0ae7db5544470f.

===================================================================
## RESUME executed — Session 7 (2026-08-31, after rate-limit reset) — Batch 6 Task 19
===================================================================
- Preflight: verify-repo-context.ps1 -Path <worktree> => PASS, branch feat/federation-inter-relay-routing, HEAD 3a09ee9. Matches ledger.
- BASE for Task 19 = 3a09ee9e3a9e911f38f613ee2188d16a1d170017.
- Implementer: sonnet, agent acf9aca595754ca8e (resume for fix rounds). Status DONE_WITH_CONCERNS. 2 commits:
  - f430c57  test(relay): federation routing regression sweep + changelog/status  (Part A: federation-regression.test.mjs 4 tests + CHANGELOG [Unreleased]/Added bullet + STATUS.md rewrite; plan-doc 111 boxes ticked in c:\Dev repo, left UNSTAGED per R19)
  - 6fb94ef  fix(federation): reaper poison-row dead-letter guard + close-out cleanup  (Part B: B1 R15 poison-row guard in federation-reaper.mjs + new 2-part test; B2 error?.message??error; B3 init usage string +--federation-owner; B4 init-federation-owner test5 no-partial-write assert; B5 outbox list CI asserts b.example/PEER_4XX; B6 drop "Transition history: (unavailable)"; B7 route-test unreachable require-msg tidy)
  - Tests: federation-regression 4/4; B1 poison-row RED->GREEN; touched reaper+init files 14/14; npm test 734 pass / 81 skip / 1 fail = pre-existing known-flaky live-ollama-worker-test.mjs (fetch failed, no local Ollama), unrelated to test-only+reaper-guard diff.
  - Implementer note: commit 2 was --amend'd once pre-review to fold an initially-missed B5 edit; still exactly 2 commits.
- Review package: review-3a09ee9..6fb94ef.diff (2 commits, 30592 bytes).
- Reviewer: sonnet, agent a0e000a44581157de. Fed global constraints + 7 named risks (regression tests non-vacuous + verbatim fixture, B1 guard shape/ownership-guard/no-body/continue + 2-part test, B1 no double-handle, Part B == exactly B1-B7, B3/B6/B7 scoped sigil.mjs edits, CHANGELOG+STATUS verbatim, commit split).
- Task 19 review: Spec compliant, Task quality APPROVED. All 7 risks CLEAR: fixture helpers character-for-character copies of validate-envelope.skip-sender.test.mjs:6-17 + accept-federated-envelope.test.mjs:9-102; 4 regression tests all assert concrete status+code (test 4 asserts distinct registry entries AND behavioral divergence 202 vs 403 DIRECTORY_LINK_REQUIRED); B1 try wraps only build+sign, canonicalBytes/signed hoisted to let, finalize ownership-guarded (if(updated) gates count+audit), payload {reason_code} only, continue present, mirrors MESSAGE_EXPIRED block; B1 test proves pass-survives + poison->dead_letter/FORWARD_BUILD_FAILED + healthy row behind still forwards (counts deep-equal {claimed:2,forwarded:1,rejected:0,failed:0,deadLettered:1}); Part B touches only the 5 expected files, no accept-envelope.mjs/federation-router.mjs/postgres-repository.mjs edits; B7 unreachable-path confirmed (withRepository throws require-msg only when !databaseUrl, call inside if(databaseUrl)); commit split correct.
- No Critical/Important. NO fix loop.
- Task 19: minor (deferred -> final review triage): CHANGELOG entry rendered as `-` bullet not brief's `>` blockquote (wording verbatim; matches section style).
- Task 19: minor (deferred): STATUS.md "Completed work" written as ~10 area-grouped bullets referencing task numbers, not 19 discrete lines (substance complete).
- Task 19: minor (deferred): STATUS.md goal/next-action differ from brief only in capitalization/trailing period.
- Task 19: minor (noted): B5 recipient_domain/last_reason_code asserts are CI-only (file SIGIL_TEST_DATABASE_URL-gated) — accepted, same R10/R14/R16 class.
- Task 19: complete (commits 3a09ee9..6fb94ef, review clean)

===================================================================
## ALL TASKS COMPLETE (1-19). FINAL whole-branch review next.
===================================================================
- Branch feat/federation-inter-relay-routing @ 6fb94ef. MERGE_BASE (branch start) = 7c2e867. 21 commits ahead of sigil-repo main.
- origin/feat/federation-inter-relay-routing @ 719d62c — commits a916cd9 (T17), 3a09ee9 (T18), f430c57 + 6fb94ef (T19) NOT pushed. Push handled by finishing-a-development-branch (R20).

===================================================================
## FINAL whole-branch review (Batch 6 / Task 19) — opus
===================================================================
- Package: review-7c2e867..6fb94ef.diff (25 commits, 218702 bytes). MERGE_BASE 7c2e867 -> HEAD 6fb94ef.
- Reviewer: opus, agent ae1645384d1cfa290. Fed plan+spec paths, all carried rulings (R6/R10/R14/R15/R16/R18), 8 deferred-minor clusters, 8 named risks.
- Verdict: **Ready to merge = With fixes.** Load-bearing rulings SURVIVED re-check: R10 shadow-upsert real+correct+live-DB-proven (postgres-repository.mjs:531-550, humans->endpoints runtime='federated'+origin_domain->endpoint_keys before envelope insert; composite (endpoint_id,owner_id) FK fails closed on local collision; placed after all rejecting checks); R14/R16 CI discovery confirmed by reading live-db-tests.mjs:21 literal marker (all 5 suites picked up, NOT skipped); R15 poison-row fix correct+complete; reaper concurrency guards clean (FOR UPDATE SKIP LOCKED + claim_token + ownership-guarded finalize, attempt_count bumped only on lease-steal); migration 017 additive-safe (NOT NULL DEFAULT FALSE, quota scope check drop/re-add bases on 012 correctly); risk 6 placeholder counts verified ($1..$21 / $1..$5).
- **1 Critical, 7 Important, 12 Minor.** Fix-wave triage (controller rulings):

- **Ruling R21 (final-review fix wave scope):** ONE fix wave, then ONE scoped re-review, then adjudicate residuals (SDD final-review contract — no second wave). Dispositions:
  - **FIX now (C1, I2-I7 + cheap minors):**
    - C1 `federation-router.mjs:91-92` postForward `res.text()` buffers whole 4xx body before the 4 KiB length test — spec (design §172) mandates a 4 KiB *read* cap. Stream `res.body`, accumulate to `PEER_BODY_READ_CAP+1`, `res.body.cancel()` on overflow, then parse. Add streaming-overflow test.
    - I2 `http-server.mjs:155` `POST /v1/federation/envelopes` mounted unconditionally -> any upgraded relay with a pinned peer silently accepts unauthenticated federated inbound. Gate route registration on `federationMode` set; 404 otherwise. Regression test: no-`--federation-mode` relay returns 404 for a well-formed signed forward.
    - I3 `postgres-repository.mjs:544-548` `registerFederatedSender` `ON CONFLICT (key_id) DO NOTHING` -> peer-chosen `key_id` colliding with another endpoint's key binds the envelope FK to the wrong key (silent). Fail closed: if a row for that `key_id` exists with a different `endpoint_id`, throw a recognised code (outer catch -> 400).
    - I4 `federation-reaper.mjs:16-17,124,140` `BACKOFF_MS` has 3 tiers but `MAX_ATTEMPTS=3` makes `1_800_000` unreachable. Set `MAX_ATTEMPTS=4` so 1m/5m/30m all walk and the 4th failure dead-letters; update reaper test + the contradictory spec §583 sentence.
    - I5 `accept-envelope.mjs:259` `recordFederationAudit` writes `federation.queued` with `outcome:'rejected'` (`endsWith('forwarded')` gate). Pass `outcome` explicitly per call site (as reaper already does); assert `outcome` in the queue-mode accept test.
    - I6 `sigil.mjs:756-760` `sigil route test --relay-url` required but never read (step 3 probes pinned `peer.relayUrl`). DROP `--relay-url` from `route test`; update `usage()` at sigil.mjs:63.
    - I7 `sigil.mjs:809-813` both owner-advisory branches uncovered; `:807` looks up `localRegistry.get(recipient)` with the raw arg not the normalized `${localPart}@${domain}`. Use normalized id; add 2 `sigil-route-test.test.mjs` cases (matching-owner -> "would apply", differing-owner -> "would NOT apply").
    - minor 2: `sigil.mjs:727` `federation outbox show` also strip `claimToken` + `claimedAt`.
    - minor 3: wrap the reaper's `recordAuditEvent` awaits in `.catch(()=>{})` (match accept-envelope.mjs:259).
    - minor 8: add the `// TODO:` CI-Postgres "reaper starts" breadcrumb in relay-up-federation.test.mjs.
    - minor 9: `sigil.mjs:182/184` relay-up warnings also name `--federation-owner`.
    - minor 10: `route test` exit 1 (not 0) when `Reachable: no` — matches the unpinned-case exit.
    - minor 11: add `origin_domain !== relayDomain` guard in `acceptFederatedEnvelope` (reject self-federation).
    - minor 12a: migration 017 header comment — document PG13 minimum (`gen_random_uuid()` core builtin; pgcrypto never `CREATE EXTENSION`ed — plan Task 2 Step 4 claim was false).
  - **R21a — I1 (HTTP call inside DB transaction, sync mode):** `accept-envelope.mjs:207/228` `forwardEnvelope` runs `postForward` (5s timeout) inside `repository.withTransaction` -> one slow peer exhausts the pool for all traffic; violates the rule stated in `federation-reaper.mjs:8-10`. Nothing is written locally on the `forward` branch, so no transaction is needed. Fixer: lift the `forward` branch OUT of the `withTransaction` wrapper IF contained (does not disturb local/reject/queue branches, roughly <= 40 lines). If it cannot be done cleanly in this wave, DOCUMENT the limitation in the spec's sync-mode section + STATUS.md and PARK as load-bearing-deferred (surfaces to the human at finishing-a-development-branch). — Cost if wrong: prod sync-mode relays under a slow peer hit pool exhaustion; recoverable by disabling sync mode; queue mode unaffected.
  - **DEFER to backlog (ledger, no code this wave):** minor 1 (build+sign before queue branch — fixer may fold if already editing that block for I1), minor 4 (`claim`/`retry` no `updated_at` bump), minor 5 (`enqueueFederationForward` binds created_at/updated_at from caller `now` not `now()`), minor 6 (lease-steal double-increments attempt_count — add a code comment only), minor 7 (no `https:` scheme allowlist on `peer.relayUrl` — TOFU yields https, `peer add` is operator action; defence-in-depth), minor 12b (`federation_outbox` unbounded growth — no prune path for terminal `forwarded` rows; needs its own retention design).

===================================================================
## Final-review fix wave + scoped re-review — DONE
===================================================================
FIX_BASE = 6fb94ef. Fix wave: sonnet, agent a9b40dae22090ad4e. ONE commit 965b968
  "fix(federation): final-review hardening — postForward read cap, inbound route gating, key-id collision guard, reaper backoff, audit outcomes"
  17 files, +450/-51. npm test 826 / 741 pass / 0 fail / 85 skip (live-ollama flake passed this run).

Dispositions applied:
- C1 postForward: streams res.body chunk-wise to PEER_BODY_READ_CAP (byte cap), res.body.cancel() on overflow, parse+PEER_CODE_RE only under cap; non-streamable body → byte-capped res.text() fallback. federation-router.test.mjs asserts peerCode omitted + reader cancelled on overflow.
- I2 inbound gating: http-server.mjs:158 route registration guarded on federationMode set (createRelayServer param threaded from cmdRelayUp sigil.mjs:240). Test: no-mode → 404 CONTEXT_NOT_FOUND; queue → 202.
- I3 key_id collision: postgres-repository.mjs:1266-1275 SELECT endpoint_id FROM endpoint_keys WHERE key_id=$1 → throw FEDERATED_KEY_ID_COLLISION when bound to a different endpoint_id; acceptFederatedEnvelope catch collapses unknown code → INVALID_FEDERATION_REQUEST/400, txn rolls back. Live-DB test (gated).
- I4 reaper backoff: MAX_ATTEMPTS 3→4; guard nextAttemptCount >= MAX_ATTEMPTS first at 4 so BACKOFF_MS[nextAttemptCount-1] reads only idx 0-2 (1m/5m/30m all walked, 4th failure dead-letters). reaper test rewritten to assert full sequence. Spec section 583 wording disambiguated (edit-in-place, not git-added).
- I5 audit outcome: recordFederationAudit gains explicit outcome param, heuristic removed; 4 callers updated (forward_unavailable/forward_rejected→rejected, forwarded→forwarded, queued→accepted). Queue test asserts federation.queued outcome === accepted.
- I6: --relay-url removed from route test (usage, usageLine, parseArgs, read, required-check); tests stop passing it.
- I7: sigil.mjs:413 lookup uses normalized localPart@domain; 2 gated route-test cases drive both owner-advisory branches.
- minors m2 (strip claimToken/claimedAt), m3 (reaper recordAuditEvent catch-swallow), m8 (TODO breadcrumb), m9 (relay-up warnings name --federation-owner), m10 (route test exit 1 on Reachable:no), m11 (self-federation guard origin_domain==relayDomain → 400 + 2 non-gated tests), m12a (017 PG13+ header note) — all applied.

- R21a resolved: I1 PARKED (documented). Lifting only the sync forward branch out of withTransaction forces reordering the shared decideRoute / REPLAY_DETECTED / rejection-audit prologue that local/reject/queue all depend on — past the ~40-line bound, regression-risky with no second review pass. Limitation documented: spec design-doc section 327-337 "Known limitation (final review, I1 — PARKED)" blockquote + STATUS.md:42-56 "Known limitations" section (sync mode holds a txn across the outbound forward, not production-ready under slow peers; queue mode is the production path). No half-done restructure left in accept-envelope.mjs. Residual load-bearing finding: surfaces to the human at finishing-a-development-branch. Cost if wrong: prod sync-mode relays under a slow peer hit pool exhaustion; recoverable by disabling sync mode; queue mode unaffected.

Scoped re-review: sonnet, agent ad5176982856eb7d9. Package review-6fb94ef..965b968.diff (1 commit, 69777 bytes).
  Verdict: All findings addressed, no new Critical/Important breakage. C1/I2/I3/I4/I5/I6/I7 all ADDRESSED with file:line evidence; I1 ADDRESSED-as-PARKED, honestly reflected (spec + STATUS carry the note, no half-done code); all 7 folded minors ADDRESSED.
  Out-of-scope (non-blocking, ledgered): (a) federation-router.mjs:1006-1008 cap checked after Buffer.from(chunk) materializes each chunk — bounded in practice (undici yields network-sized chunks); (b) sigil.mjs:413 normalized lookup does not lowercase domain — consistent with printed canonical form + v1 federated-id semantics, pre-existing.

===================================================================
## ALL BATCHES COMPLETE — branch ready for finish
===================================================================
Branch feat/federation-inter-relay-routing @ 965b968. MERGE_BASE (branch start) 7c2e867. 22 commits ahead of sigil-repo main.
origin/feat/federation-inter-relay-routing @ 719d62c — UNPUSHED: a916cd9 (T17), 3a09ee9 (T18), f430c57 + 6fb94ef (T19), 965b968 (final-review fix wave).
Next: finishing-a-development-branch (push of the 5 unpushed commits to the shared branch + PR decision — R20). Push to a shared branch is a stop-and-confirm point: present to the human.

### Uncommitted, in the c:\Dev repo (NOT sigil-repo) — left for that repo's owner (R19):
- docs/superpowers/plans/2026-08-30-sigil-inter-relay-routing.md — 111 task boxes ticked
- docs/superpowers/specs/2026-08-30-sigil-inter-relay-routing-design.md — I4 section-583 wording + section 327-337 I1 known-limitation blockquote

### Rulings made (R1-R21a) — full finish list
- R1 (T1): mutual-exclusion error message must contain substring "both --owner and --federation-owner" so plan Task 1 Step 1 test 5 passes unmodified. Cost if wrong: string-wording tweak, visible in diff.
- R2 (T1): plan defect — brief tests used --domain a.example (RFC 2606, never DNS-resolves) but cmdInit runs resolveDomainOrThrow first. Swapped to --domain local + @local id assertions in the new test file only; kept cross-domain owner usr_chris@primary.example. Cost if wrong: test-only domain-literal churn in one new file.
- R3 (T2): authorized 20->21 + added assertion at postgres-repository.test.mjs:28, folded into Task 2 commit (federation_hop INSERT param = necessary consequence of the required schema change). Cost if wrong: one-token test edit in the same commit.
- R4 (T3): applied plan Task 3 Step 2 contingency — synthetic registered entry owner_id mismatch (usr_other@a.example) so test 1 is a genuine RED (ROUTE_NOT_AUTHORIZED) pre-impl. Cost if wrong: one test-fixture value change.
- R5 (T2 fix round 1): plan-mandated weak test (test 2 asserting nothing about federation_hop) IS a real rubric defect; authorized a 1-round fix folding the Important + 2 minors into commit fb5aea8. Cost if wrong: 4-line test/comment churn in files the task already owns.
- R6 (Batch 2 carry-forward): final-review IMPORTANT-1 (envelopes sender FKs block Task 9 federated persist on Postgres) is a forward-blocking PLAN defect, not a Batch-1 code defect. Ruled NOT to fix in Batch 1. RESOLVED in Batch 3 via R10 shadow-upsert. Cost if wrong: Tasks 9-12 green on memory-repo, CI live-DB breaks at Task 14+ (mitigated by R10).
- R7 (Batch 1 final fix wave scope): ONE fix subagent for IMPORTANT-2 + minors 6/7/9 only. Minors 3/4/5 → Task 19; 8/10 → backlog. Cost if wrong: doc comment + 2 test blocks + 1 CHECK constraint, all in diff.
- R8, R9 (Batch 2): federation-router.mjs append-order / duplicate-import rulings (Session 4 tables). Low cost, test-file only.
- R10 (Batch 3): shadow-upsert foreign sender (humans→endpoints runtime=federated + origin_domain→endpoint_keys) before the envelope insert, resolving R6. Placed after all rejecting checks; composite (endpoint_id,owner_id) FK fails closed on local collision. Live-DB proven at Task-9/10 + re-verified by final review. Cost if wrong: a foreign sender colliding with a real local endpoint id → 23503/400 (fail-closed) OR silent mis-bind (final review + I3 fix closed the key_id variant).
- R11 (Batch 3): Session 5 table.
- R12 (Batch 4): ship enqueueForward forward-ref in accept-envelope.mjs before Task 14 defines it. Cost if wrong: a broken reference caught by Task 14 own tests one batch later.
- R13 (Batch 4): --domain local in the new relay-up federation tests (same RFC-2606 class as R2). Cost if wrong: test-only churn.
- R14 (Batch 5, T13/T14): new live-DB test files guard AND read process.env.SIGIL_TEST_DATABASE_URL, not SIGIL_DATABASE_URL (brief said the latter). Cost if wrong: 2 files SKIP in CI; one-line guard fix. Final review confirmed live-db-tests.mjs:21 discovers by that literal string.
- R15 (Batch 5, T15): unguarded buildForwardRequest/signForwardRequest in the reaper (poison row wedges the batch) ACCEPTED as documented limitation for Batch 5; deferred fix folded into Task 19. FIXED in Task 19 commit 6fb94ef (B1). Cost if wrong: n/a — fixed.
- R16 (Batch 6, T17): sigil-federation-outbox.test.mjs guards on SIGIL_TEST_DATABASE_URL, passes it via --database-url (R14 class). Cost if wrong: file SKIPs in CI; one-line guard fix. Confirmed discovered by live-db-tests.mjs.
- R17 (Batch 6, T18): sigil route test test uses sigil init <name> --domain local (R2 class); DB sub-case guards SIGIL_TEST_DATABASE_URL. Cost if wrong: test-only domain-literal churn in one new file.
- R18 (Batch 6, T17): federation outbox retry bare {retried:false} (id missing / wrong state) → non-zero-exit "not in a retryable state", distinct from the MESSAGE_EXPIRED branch. Cost if wrong: one wording choice on an error path, in the test + diff.
- R19 (Batch 6, T19): plan Step 6 box-ticking done by editing the plan doc at C:\dev\docs\... in place (c:\Dev repo, not sigil-repo) — NOT git-added to Task 19 commit; that repo staging left for its owner. Cost if wrong: box-ticks sit as an uncommitted diff in c:\Dev until someone commits/reverts; cosmetic.
- R20 (Batch 6, T19): plan Step 7 (git push + gh pr create) NOT run as part of Task 19; push + PR decision handled once, after the final whole-branch review, by finishing-a-development-branch. Cost if wrong: none material.
- R21 (final-review fix wave scope): ONE fix wave — C1 + I2-I7 + cheap minors m2/m3/m8/m9/m10/m11/m12a — then ONE scoped re-review, then adjudicate residuals (SDD final-review contract, no second wave). Review-minors 1/4/5/6/7/12b deferred to backlog. Cost if wrong: a genuinely-needed hardening item ships as a backlog note instead of code.
- R21a (I1): sync-mode postForward inside withTransaction — contained lift not safe within scope (forces reordering the shared decideRoute/REPLAY/audit prologue). PARKED with the limitation documented in spec section 327-337 + STATUS.md "Known limitations". Residual load-bearing finding surfaced to the human at finish. Cost if wrong: prod sync-mode relays under a slow peer hit pool exhaustion; recoverable by disabling sync mode; queue mode (the production path) unaffected.

### Backlog (raise at plan close-out / sub-project #4)
- I1 sync-mode transaction boundary (parked — see R21a).
- review-minor 4: postgres-repository.mjs claimDueFederationForwards / retryFederationForward never bump updated_at (finalize does).
- review-minor 5: enqueueFederationForward binds created_at/updated_at from caller now not DB now().
- review-minor 6: lease-steal double-increments attempt_count (claim CASE bump + reaper +1) — crash-recovered rows reach dead_letter ~2x faster. Code comment added; behavior accepted.
- review-minor 7: no https: scheme allowlist on peer.relayUrl (TOFU yields https, peer add is operator action; defence-in-depth).
- review-minor 12b: federation_outbox has no retention/prune for terminal forwarded rows (full envelope JSONB each) — unbounded growth on a busy queue-mode relay.
- pgcrypto never CREATE EXTENSION-d — 017 relies on gen_random_uuid() core builtin (PG13+); header comment now notes it. If anyone targets PG<=12, add CREATE EXTENSION IF NOT EXISTS pgcrypto;.
- CI live-DB matrix (SIGIL_TEST_DATABASE_URL) is the first real execution of the whole federation Postgres path: R10 shadow-upsert, migration 017, federation_outbox claim/finalize/retry, I3 key_id collision guard, I5 audit outcome, I7b + m10 route-test cases. If CI live-DB is red after push, look there first.

===================================================================
## FINAL fix wave + scoped re-review — DONE
===================================================================
- FIX_BASE 6fb94ef. Fix wave: sonnet, agent afaad5a49f47e39db. ONE commit 965b968 (17 files, +450/-51):
  "fix(federation): final-review hardening — postForward read cap, inbound route gating, key-id collision guard, reaper backoff, audit outcomes".
  (Commit produced by repo auto-commit-on-stage hook; single intended commit, correct subject + file set, Co-Authored-By Claude Sonnet 5. Working tree clean. Fixer's "already implemented by a prior session" remark was its own confusion — history is single/clean, no foreign commits, dev-93 confirmed stood down.)
  npm test: 826 tests / 741 pass / 0 fail / 85 skip; dep-audit + jcs-audit pass; known-flaky live-ollama-worker-test.mjs noise only.
- Re-review: sonnet, agent a6ca9badb13f6d7ab. Package review-6fb94ef..965b968.diff (1 commit, 69777 bytes).
- Re-review verdict: **All findings ADDRESSED, no new Critical/Important breakage.**
  - C1 ADDRESSED — federation-router.mjs:988-1033 streams res.body, byte-accounts, cancels reader on `total > PEER_BODY_READ_CAP`, JSON-parse only within cap, PEER_CODE_RE unchanged; new tests (64x1KiB → cancelled+peerCode omitted; 3 sub-cap chunks → parsed).
  - I1 ADDRESSED-as-PARKED — no accept-envelope.mjs txn-boundary change (local/reject/queue intact); STATUS.md:42-56 "Known limitations" + spec design-doc:327-337 blockquote both present + explicit (sync mode holds DB txn across forward, not prod-ready under slow peers, use queue mode). LOAD-BEARING DEFERRED — surfaces at finishing-a-development-branch.
  - I2 ADDRESSED — http-server.mjs:33 real param, :152 guard `if (federationMode && POST && pathname==='/v1/federation/envelopes')`; distinct pathname, no effect on /v1/envelopes etc.; tests undefined→404 + `queue`→202.
  - I3 ADDRESSED — postgres-repository.mjs:544-556 pre-insert `SELECT endpoint_id FROM endpoint_keys WHERE key_id=$1`; different endpoint_id → throw {code:'FEDERATED_KEY_ID_COLLISION'} → outer catch collapses to INVALID_FEDERATION_REQUEST/400, txn rolls back; own-key idempotent. Live-DB test accept-federated-envelope.pg.test.mjs:602-682 (SIGIL_TEST_DATABASE_URL-guarded, CI-gated).
  - I4 ADDRESSED — MAX_ATTEMPTS 3→4, guard `nextAttemptCount >= 4`, `BACKOFF_MS[nextAttemptCount-1]` reaches idx 0/1/2 only (idx 3 unreachable, no OOB); reaper test walks 60s/300s/1800s passes 1-3 then dead_letter pass 4; spec updated at 4 sites (§61-68/§390-395/§497-498/§602-605).
  - I5 ADDRESSED — recordFederationAudit signature takes explicit `outcome`; 4 call sites: forward_unavailable→'rejected', forwarded→'forwarded', forward_rejected→'rejected', queued→'accepted'; queue live-DB test asserts queued outcome !== 'rejected' && === 'accepted'.
  - I6 ADDRESSED — --relay-url dropped from usage()/usageLine/parseArgs/required-check in cmdRoute; removed from all 3 route-test test call sites.
  - I7 ADDRESSED — sigil.mjs:812 normalized `${localPart}@${domain}` lookup; 2 new tests "would apply" / "would NOT apply — owner ids differ" (live-DB guarded).
  - Minors m2/m3/m8/m9/m10/m11/m12a all ADDRESSED.
- Re-review non-blocking notes (ledgered, no action this branch):
  - I2: with `federationMode` unset AND a transport authenticator configured, POST /v1/federation/envelopes now 401s (falls to auth gate) rather than 404 — cosmetic, matches every other unknown authenticated path; finding intent (no unauthenticated accept surface) met.
  - m11: self-federation reject at accept-federated-envelope.mjs:46-48 returns `respond(...)` with no `auditInboundReject` call (unlike structural checks 2-5) — minor observability gap. -> backlog.
- C1 / I3 / I5-queue-audit / I7 / m10-pinned-unreachable assertions are SIGIL_TEST_DATABASE_URL-guarded, SKIP locally; re-reviewer inspected test code as sound; CI live-DB matrix is the accepted execution gate (same R10/R14/R16 carry-forward class).

===================================================================
## FINAL REVIEW CLEAN (with I1 parked). Branch ready for finishing-a-development-branch.
===================================================================
Branch feat/federation-inter-relay-routing @ 965b968. 26 commits ahead of sigil-repo main (7c2e867). origin @ 719d62c — a916cd9 (T17), 3a09ee9 (T18), f430c57 + 6fb94ef (T19), 965b968 (final fix wave) NOT pushed.
Deferred / parked residuals for the human (finishing-a-development-branch):
- **PARKED I1 (load-bearing):** sync-mode forward runs `postForward` (5s) inside `repository.withTransaction` -> a slow pinned peer pins a pool connection for all traffic. Not fixed: contained lift-out forces reordering the shared decideRoute/replay/rejection-audit prologue across local/reject/queue branches, past the one-wave budget. Documented in spec sync-mode section + STATUS.md "Known limitations". Queue mode unaffected. Real fix = take the forward path off the transactional accept in a follow-up.
- Backlog (no code): m11 self-federation reject has no audit event; review-minors 4 (claim/retry no updated_at bump), 5 (enqueueFederationForward binds created_at/updated_at from caller `now`), 6 (lease-steal double-increments attempt_count — comment only added), 7 (no https: scheme allowlist on peer.relayUrl — TOFU yields https, peer add is operator action), 12b (federation_outbox no prune/retention for terminal `forwarded` rows — full envelope JSONB each, unbounded growth on busy queue relay); backlog note: plan Task 2 Step 4's "gen_random_uuid() already in 001_initial.sql" claim was FALSE (pgcrypto never CREATE EXTENSION'd; works on PG13+ core builtin — now noted in 017 header).
- CI live-DB matrix (SIGIL_TEST_DATABASE_URL) is the first real execution of the whole federation Postgres path: R10 shadow-upsert, migration 017, federation_outbox claim/finalize/retry, the new I3 key-id collision guard. If CI live-DB is red, look there first.

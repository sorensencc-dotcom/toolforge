---
name: session-wrap-2026-09-01-parallel-search-recovery-spec
description: "parallel-search skill recovery spec written, eng-reviewed, all OQs resolved, committed but unpushed due to branch divergence"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3f4f943d-9144-49f2-9b98-ebe1d59555db
  modified: 2026-09-01T15:50:09.405Z
---

Recovery review of `skills/parallel-search/` (fail-closed Parallel API wrappers
+ Cast Iron Charlie deep-research adapter), shipped by Codex to `origin/main`
across PR #15 (`658da2aa`) + `bff19bbf` with no design doc. Wrote the missing
spec, ran `/plan-eng-review` against it, folded findings, resolved all 5 open
questions with the user, committed. **Did not push — see Blocker below.**

**Why:** [[feedback_verify_ai_design_doc_premises]] pattern again — code
shipped, no spec, claims unverifiable until checked against ground truth.
Grounded the spec against the real `parallel-web@0.3.2` SDK (`.d.ts` files),
not the shipped code's assumptions, and it turned up a real P0: shipped
`index.ts` calls `client.search(...)` / `client.extract(...)`, which don't
exist on the top-level client — real paths are `client.beta.search` /
`client.beta.extract`. Every non-mocked call has been throwing since ship,
swallowed by a blanket `catch` into `PARALLEL_API_ERROR`. Zero real-API test
coverage (5 tests, all mocked) meant nobody would have caught this without
grounding against the actual SDK types.

**How to apply:** When reviewing/speccing code that wraps a third-party SDK,
read the installed package's own `.d.ts` files before trusting the wrapper's
assumed shape — `node_modules/<pkg>/**/*.d.ts` is cheap ground truth and
caught 3 of 11 defects here that no amount of reading the wrapper code alone
would have surfaced (wrong call paths, invented `search_queries` 2-3 cap with
no basis in the API, adapter reading nonexistent `snippet`/`link` fields).

**Spec:** `docs/superpowers/specs/2026-08-31-parallel-search-integration-design.md`
v1.2, repo `toolforge` (`C:\dev`). 11 shipped defects (P0/P1/P2), full SDK
contract section, fail-closed error model, Charlie adapter contract, async
task lifecycle for deferred `parallel_task_result`. `/plan-eng-review` folded
in: 4 architecture + 5 code-quality + 3 performance findings, test plan
expanded ~8→~28 cases, 1 critical regression (adapter field mismatch), 2
residual failure-mode gaps (orphaned Task Run on timeout / on unpolled create).

**5 open questions, all resolved by operator decision 2026-09-01:**
in-repo distribution (not standalone) · Charlie Task Run processor `core`
default + `CHARLIE_PARALLEL_PROCESSOR` env override · timeout 300s
default/600s max (fixed, not placeholder) · cost ceiling permanently out of
the wrapper, enforced at the CIC agent layer only · external Parallel
milestone URL treated as informational/non-blocking (never found — checked
`node_modules/parallel-web/README.md` and the Codex phase-1 worktrees at
`dev-sandbox/toolforge-parallel-phase1-20260830/`, not there either).

**Blocker — push failed, unresolved:** committed `2720aefe` (spec only, clean
diff) to `spec/sigil-inter-relay-routing`, but `git push` was rejected
non-fast-forward. Not a simple behind-by-N — real divergence: several commits
exist on both local and `origin/spec/sigil-inter-relay-routing` with identical
messages but **different hashes** (e.g. `feat(toolforge): register
parallel-search skill` is `f66cb974` locally vs `5b399e57` on remote — looks
like the branch was rebased/rewritten remotely at some point), plus each side
has commits the other lacks (remote: several `fix(ci)`/governance-restore
commits; local: IronLedger phase-0/1 docs + TRM GAP-02..06 resolutions). Did
NOT merge, rebase, or force-push — too much unrelated work on both sides to
reconcile unilaterally. **Next session: decide reconciliation strategy before
touching this branch further** (fetch + diff both sides fully first; this may
warrant an [[incident_git_reset_data_loss_2026-07-16]]-style caution pass).

**Next (Track B, unblocked once branch is sorted):** fix-up PR — T1 (SDK
paths + `Pick<Parallel,"beta"|"taskRun">` typing), T2 (remove invented cap),
T3 (adapter regression fix), T4 (tsconfig + typecheck + fix `npm test`),
T5 (README corruption). One PR per task, human review, from a
`C:\dev\dev-sandbox` checkout per [[project-sigil-npm-packaging-decision-2026-08-15]]-style
process discipline — `C:\dev` itself stays read-only for this track.

Session ran ~3.5h continuous — this is the natural handoff point (spec locked,
nothing mid-flight, one clean blocker to resume on).

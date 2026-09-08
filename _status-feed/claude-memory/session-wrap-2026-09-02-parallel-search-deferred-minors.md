---
name: session-wrap-2026-09-02-parallel-search-deferred-minors
description: "Cleared the 4 carried deferred minors from the 2026-09-01-parallel-search-fixup SDD plan; PR #25 open on toolforge, awaiting operator merge."
metadata: 
  node_type: memory
  type: project
  originSessionId: b5f44abf-3e0f-4169-8593-e4f855b4e919
  modified: 2026-09-02T16:40:04.890Z
---

Short session (~30 min). Cleared the four non-blocking deferred follow-ups left after the `2026-09-01-parallel-search-fixup` SDD plan (main was `c4bce21`). See [[session-wrap-2026-09-02-parallel-search-fixup-complete]] for the plan those came from.

Branch `chore/parallel-search-deferred-minors` off toolforge main, one code commit `27d899d`. **PR #25** — https://github.com/sorensencc-dotcom/toolforge/pull/25 — OPEN, MERGEABLE, awaiting operator merge auth (per-PR cadence, same as #18–#24).

Changes, all under `skills/parallel-search/`:
1. `src/error-hygiene.test.ts` (new, +3 tests) — static scan of `index.ts`: every `error(` call site and every inline `code: "…"` error literal must be in the `ErrorCode` union; allow-list is parsed from the `export type ErrorCode` declaration so it self-updates on a real union change but fails a typo/drift.
2. `charlieResearchQueries(topic)` — exported named helper in `charlie-deep-research-adapter.ts` returning `[t, "t history", "t primary sources"]`, replaces the 3 inline `search_queries` literals. +1 adapter test pins the triple.
3. Removed `fixtures/search-result.json` + `fixtures/task-run.json` (`git rm`) — zero test refs; live shapes covered by `index.smoke.test.ts`. `fixtures/` dir gone.
4. `SKILL.md` — removed stale "result retrieval belongs to a later integration phase" line; added `parallel_task_result` to the exports list with a one-line `wait:false`/`wait:true` + timeout-`run_id` contract summary.
- `scripts/assert-test-count.mjs` `EXPECTED_MIN` 29 → 35.

Verification: `npm test` **35/0** (was 31), `npm run typecheck` exit 0, `npm run test:smoke` 2 skipped (no `PARALLEL_API_KEY`).

**No deferred minors remain from the parallel-search-fixup SDD plan.** Still open in a separate cosmetic lane (cross-task, not blocking): `as any` mock casts vs `as unknown as Client`; `"Parallel request failed"` as a module constant (T4-M1); `isTaskResultWait` inline predicate has no type alias (T4-M2); T3 `hasObjective`/`hasQueries` recomputed in validate + networkFn (plan-mandated).

Ledger (gitignored working file): `dev-sandbox/toolforge-sigil-fixup/.superpowers/sdd/2026-09-01-parallel-search-fixup/progress.md` — "Deferred-minors cleanup PR" section appended.

Next: operator merges PR #25 (squash), fast-forward local main.

# Wave D Completion Report — Integration, E2E, Perf, Scheduler

**Phase 9 Marketplace | Wave D | 2026-07-14**
**Status: CODE-COMPLETE (code level). Live gate DEFERRED — no PostgreSQL in this environment.**

Builds on Wave C (commit `087d08e`): `createApp(db)` factory, set-based
`runTrendingRefresh(db)`, ratings/related/categories routers, SemVer resolver.

---

## Gate statement

> **Wave D validated at CODE LEVEL ONLY.** Live perf `<200ms p99` and live E2E
> execution are **BLOCKED** by missing PostgreSQL in this environment. Full Wave D
> gate requires: provisioned PG in target environment + rerun E2E/perf/load to
> assert `<200ms p99`.

No scheduled task was installed. No PostgreSQL was provisioned or started. No
live DB connection was attempted. The only commands executed were `node --check`
(syntax) and the guarded `npm run e2e` / `npm run load:marketplace` to prove they
green-skip without a database.

---

## What was built (code artifacts)

### 1. Trending scheduler (code only — NOT installed)
- `src/services/trending-scheduler.ps1` — registers a Windows Scheduled Task
  (`ToolforgeTrendingRefresh`) invoking `npm run trending:refresh` daily at
  00:00 UTC via the **Schedule.Service COM** API (per memory
  `session-2026-07-12-wmi-solution.md`, not `schtasks.exe`). Idempotent
  (delete-if-exists then create); `-Unregister` switch for rollback; params
  `-TaskName`, `-RepoPath`, `-DailyTimeUtc`. Header marks it NOT auto-installed.
- npm scripts `trending:schedule` / `trending:unschedule` (added, **not run**).
- `docs/wave-d/TRENDING-SCHEDULER.md` — install / verify / rollback runbook,
  incl. DST/timezone note.

### 2. E2E scenarios (`src/e2e/`)
- `harness.js` — runner + helpers. Boots the real `createApp(db)` on an
  ephemeral port and drives it with `fetch` (same pattern as
  `src/api/server.test.js`). **Guard:** unset `DATABASE_URL` -> prints
  `E2E requires provisioned PG — set DATABASE_URL` and exits **0** (green-skip);
  `pg`/`server` imported dynamically only after the guard. Per-run id prefix +
  `teardown` make seed/teardown idempotent.
- Five charter flows, each arrange -> act -> assert, self-contained:
  - `01-discover.e2e.js` — list / search / category filter / detail / 404.
  - `02-install.e2e.js` — resolve `^1.0.0` -> `1.2.0`, log install for resolved
    version, assert install_log row; bad constraint -> 400.
  - `03-rate.e2e.js` — POST 201, dup POST 409, no-auth 401, PUT edit 200,
    two-user aggregate avg, ratings list; user_id from session not body.
  - `04-update.e2e.js` — publish 1.1.0; caret pin re-resolves 1.0.0 -> 1.1.0
    (not 2.0.0); exact pin stable; versions listing.
  - `05-trending.e2e.js` — spike vs flat installs, `runTrendingRefresh`, assert
    trend_score/direction in DB and that spike outranks flat via
    `GET /skills/trending`.
- npm script `e2e` (added, guarded-skip verified, **not run live**).

### 3. Load-test harness (`src/load-tests/`)
- `marketplace-load.js` — parametrized: DEFAULT constants 50k users / 1k skills /
  100 concurrent installs, all env-overridable. Seeds a marketplace, refreshes
  trending, drives read load across `list`/`search`/`trending`/`ratings` plus a
  concurrent install-write workload, computes p50/p95/p99 per endpoint, emits a
  JSON report, and gates on p99 < 200ms. Same **guard** (skip-exit-0 without
  `DATABASE_URL`); style follows `src/stress-tests/gate04-fairness.js`.
- npm script `load:marketplace` (added, guarded-skip verified, **not run live**).
- `docs/wave-d/LOAD-TEST.md` — how to run in a provisioned env, the p99 < 200ms
  acceptance criterion, param table, and report interpretation.

---

## Verification performed (code level)

| Check | Result |
|---|---|
| `node --check` on all 7 new `.js` files | PASS (all OK) |
| `npm run e2e` with `DATABASE_URL` unset | Skip message, **exit 0**, no connection |
| `npm run load:marketplace` with `DATABASE_URL` unset | Skip message, **exit 0**, no connection |
| PowerShell parse of `trending-scheduler.ps1` (`Parser::ParseFile`) | PASS (0 errors) |
| Scheduled task installed | **No** (by constraint) |
| PostgreSQL provisioned / started / connected | **No** (by constraint) |

---

## Charter criteria: code-complete vs deferred-to-live

| Criterion | Status | Where |
|---|---|---|
| Nightly trending scheduler (00:00 UTC) | **Code-complete** | `trending-scheduler.ps1` |
| Scheduler idempotent + rollback | **Code-complete** | `-Unregister`, delete-if-exists |
| 5 E2E scenarios authored | **Code-complete** | `src/e2e/0[1-5]-*.e2e.js` |
| E2E green-skip without DB | **Verified** | `npm run e2e` exit 0 |
| Load harness (50k/1k/100 params) | **Code-complete** | `marketplace-load.js` |
| p50/p95/p99 per endpoint reporting | **Code-complete** | `summarize()` + JSON report |
| Load green-skip without DB | **Verified** | `npm run load:marketplace` exit 0 |
| Runbooks (scheduler, load) | **Code-complete** | `docs/wave-d/*.md` |
| **Scheduler actually installed** | **Deferred-to-live** | run `npm run trending:schedule` in target |
| **E2E executed green against PG** | **Deferred-to-live** | set `DATABASE_URL`, `npm run e2e` |
| **p99 < 200ms asserted (live)** | **Deferred-to-live** | `npm run load:marketplace` in target |
| **Zero-regression vs Phase 8 (live)** | **Deferred-to-live** | run full suite in target |

---

## Runbook pointers
- Scheduler: `docs/wave-d/TRENDING-SCHEDULER.md`
- Load test: `docs/wave-d/LOAD-TEST.md`
- E2E: run `npm run e2e` with `DATABASE_URL` set against a dedicated test DB
  (migrations `0001`+`0002` applied). Scenarios self-seed and self-teardown by
  run-id prefix.

## To close the live gate (target env, sequential)
1. Provision PostgreSQL 15+; export `DATABASE_URL`.
2. `npm install` && `npm run migrate` (applies `0001` + `0002`).
3. `npm run e2e` — expect 5/5 scenarios PASS.
4. `npm run load:marketplace` (optionally at reduced scale first) — expect
   `acceptance.pass = true` (all read endpoints p99 < 200ms).
5. `npm test` — confirm zero regressions vs Phase 8.
6. `npm run trending:schedule` — install the nightly task; verify with
   `Get-ScheduledTask ... | Get-ScheduledTaskInfo`.

## Blockers
- **No PostgreSQL in this environment** — the sole blocker. All live execution
  (E2E pass, p99 measurement, scheduler install, regression run) is deferred to a
  provisioned target environment. No other blockers; all code artifacts are in
  place and pass code-level checks.

# Wave C Backend Build — Report

**Phase 9 Marketplace | Codex (backend) scope | 2026-07-14**
Status: COMPLETE. Built per `scratchpad/WAVE-C-DESIGN-DECISIONS.md` §7.

## Test Results (`npm test`)

```
tests   139
pass    120
fail     19   <- all pre-existing, DB-integration only (see below)
```

**All Wave C tests pass.** The 19 failures are NOT Wave C regressions — they are the
pre-existing Wave A-B tests that call schema functions against a live PostgreSQL
(`ECONNREFUSED ::1:5432` — no local PG in this environment), plus one pre-existing
assertion bug in `analytics.test.js` (`getBatchTrending` wraps the error string).
Verified against baseline before any Wave C edit: identical failure set.

Wave C tests are DB-free by design (mock `db`, injected `createApp(db)`):

| Suite | New tests | Result |
|-------|-----------|--------|
| `validators/semver.test.js` (extended) | 0.x caret, prerelease matrix, ordering chain, malformed input, 3 acceptance cases | PASS |
| `services/trending-batch.test.js` | `computeSpikeScore` edge cases + set-based single-query assertion | PASS |
| `services/ratings.test.js` | validation matrix + concurrency (concurrent POST -> one 201, one 409) | PASS |
| `services/recommendation.test.js` | category default, sparsity fallback, co-install boost, dedupe | PASS |
| `api/server.test.js` (extended) | route ordering, ratings 201/400/401/409/404/200, related, categories, resolve 400 | PASS (18/18) |

Run Wave C suites in isolation to see them green without PG:
`node --test src/validators/semver.test.js src/services/*.test.js`
`node --test --test-name-pattern="route ordering|categories|related|ratings endpoints|resolve" src/api/server.test.js`

## Deliverables

### 1. Migration `0002_wave_c_taxonomy_ratings.sql`
- `categories` table (id, slug UNIQUE, display_name, description, parent_id nullable 2-level, sort_order) + indexes.
- `trending_metrics.trend_score NUMERIC(12,4)` column + `idx_trending_trend_score`.
- Supporting indexes: `idx_skills_category_status`, `idx_installation_log_user_skill`.
- Idempotent backfill of `categories` from distinct `skills.category` (humanized display_name, `ON CONFLICT DO NOTHING`).

### 2. `schema.js` extensions
`createRating` (DO NOTHING -> null on conflict), `updateRating` (upsert), `getRatings({limit,offset})`,
`getUserRating`, `listCategories` (with published skill_count), `getRelatedSkills`, `refreshTrendingBatch`
(single set-based CTE upsert — no N+1). Plus supporting `getTopRatedSkills`, `countInstalls`,
`getCoInstalledSkills`. The old grouped `getRatings` was renamed `getRatingDistribution` (was unused
elsewhere). `getTrendingMetrics` now ranks by `trend_score DESC` (tie-break on window install count).

### 3. `semver.js` — both bugs fixed
- **Bug 1 (0.x caret):** `caretUpper()` special-cases major=0 (`^0.2.0 -> <0.3.0`) and major=minor=0
  (`^0.0.3 -> <0.0.4`). Acceptance case 2 (`^0.2.0` over `[0.2.0,0.2.9,0.3.0]` -> `0.2.9`) now passes;
  old code returned `0.3.0`.
- **Bug 2 (prerelease compare):** replaced `localeCompare` with SemVer §11 dot-separated identifier
  comparison (numeric-vs-numeric numerically, numeric < alphanumeric, longer set wins). Full precedence
  chain test (`beta.2 < beta.11`, etc.) passes.
- Added `satisfies(version, constraint)` (prerelease-aware). Prerelease policy enforced: `^1.2.0` does
  NOT match `1.2.0-rc1`; exact `1.2.0` does NOT match `1.2.0-beta`; `^1.2.0-rc1` matches `1.2.0-rc2`/`1.2.0`.
- Error contract: malformed constraint/version -> `SemVerError`; valid-but-unsatisfiable -> `null`.
- Added `x.*` wildcard. Signatures stable (`resolvePin`, `satisfies`, `parseVersion`, `compareVersions`).

### 4. Services
- `recommendation.js` `getRelated` — category default, co-install blend (`0.6*cat + 0.4*coinstall`) when
  target has >=100 installs, sparsity fallback (<5 -> global top-rated backfill, deduped). `RecommendationError`.
- `trending-batch.js` `runTrendingRefresh` (set-based, scheduler entrypoint; runnable via
  `npm run trending:refresh`) + pure `computeSpikeScore` matching the SQL formula. `TrendingBatchError`.
- `ratings.js` `submitRating(..., {mode})` — server-side score 1..5 + review_text cap validation,
  create->409 on conflict, edit->idempotent upsert. `RatingError` carries `.status`.

### 5. API routes (split routers)
- `routes/ratings.js`, `routes/categories.js`, `routes/related.js` (related + resolve) mounted via
  `createApp(db)` factory. `server.js` refactored to a factory (testable w/ injected db; only `listen`s when run directly).
- **Route-ordering bug FIXED:** `GET /api/v1/skills/trending` now registered BEFORE `/:id`. Test proves
  it returns trending data instead of `getSkill('trending') -> 404`.
- Endpoints + status codes: POST ratings 201/400/401/409, PUT 200/400/401/404, GET ratings 200,
  GET related 200, GET categories 200, GET resolve 200/400/404.
- **Security:** `user_id` from auth context (`req.userId` via `middleware/auth.js`), NEVER request body
  (test asserts a body-supplied `user_id`/`userId` is ignored). Score validated server-side before the DB
  CHECK. `review_text` length capped (5000). Per-user fixed-window rate limit on POST/PUT
  (`middleware/rate-limit.js`, 10/min).

### 6. Fixtures (Day-1 unblock)
Fixtures already existed at `src/ui/fixtures/` (frontend built against them). **Contract reconciliation:**
they use the **camelCase** frozen contract (design §7 typedefs) but the new endpoints were emitting raw
snake_case DB rows. Added `src/api/serializers.js` (toRating/toCategory/toSkillSummary/toTrendingItem) so
the API matches the fixtures exactly (`skillId`, `reviewText`, `displayName`, `parentId`, `sortOrder`,
`trendDirection`, `trendScore`, nested `rating:{average,count}`). Fixtures left as-is; API now conforms.

## Notes / Coordination Flags

1. **DB-integration tests need a live PostgreSQL** — 19 failures are purely `ECONNREFUSED`. Run `npm run
   migrate` (incl. new `0002`) against a PG 15 instance to exercise them. Not a Wave C defect.
2. **Pre-existing bug (not fixed, out of scope):** `analytics.test.js` `getBatchTrending accepts window
   param` asserts the raw error string but the service wraps it — the test was already failing pre-Wave-C.
3. **Trending `growthPct`** in `trending.json` is not persisted (derived UI concern); API emits
   `trendScore` + `trendDirection` + window install counts instead. Frontend should derive/omit growthPct.
4. **Trending envelope:** fixture is `{7d:{data},30d:{data}}` (static, both windows); live endpoint is
   `?window=7d|30d -> {data:[...]}`. Item shape matches; frontend selects window via query param.
5. `refreshTrendingBatch` uses `ln(x)/ln(2)` for log2 (portable across PG versions).

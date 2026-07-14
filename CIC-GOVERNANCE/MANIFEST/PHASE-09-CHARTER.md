# Phase 9 Charter: Marketplace UI + Discovery API + Advanced Features

**Status:** APPROVED (Tier 1: 2026-07-14)  
**Gate Sign-off:** 2026-07-26 (Phase 8 closure)  
**Target Delivery:** 2026-08-09  
**Authority:** Tier 1 approved  
**Version:** 1.0
**Tier 1 Sign-off:** Chris Sorensen (2026-07-14)

---

## 1. Phase Overview

Phase 9 builds the marketplace UX layer and discovery infrastructure that phase 8 infrastructure enables. Deliverables:

1. **Discovery API** — REST, versioned (v1), internal-only, schema-driven skill browsing
2. **Marketplace UI** — Web-primary, search/filter/install/version-pin workflows
3. **Advanced Features** — Ratings, reviews, trending, version management, install analytics
4. **Integration & Performance** — E2E tests, caching, stress benchmarks

**Rationale:** Phase 8 delivered validator + conformance gate; Phase 9 removes friction for developers to discover and install from the registry. No new governance, no new compliance layers — only UX + backend API.

---

## 2. Success Criteria

**Launch Gates:**
- [ ] Discovery API deployed, all 5 core endpoints live (list, search, detail, versions, trending)
- [ ] Marketplace UI loads list in <500ms, search in <200ms
- [ ] Web UI supports search, filter, install, version-pin; no crashes on 500+ skills
- [ ] CLI supports install + version-pin workflows; mirrors web UI capability set
- [ ] All E2E tests pass (5/5 integration scenarios); zero data races in stress tests
- [ ] Ratings/reviews functional; minimum 10 skills reviewed by dogfooding
- [ ] Zero regressions vs Phase 8 validator + CLI install

**Performance Targets:**
- API list 50 skills: <100ms (p99)
- API search 1000 skills: <200ms (p99)
- UI render browse: <500ms (p99)
- Marketplace rating ingest: <50ms per review

**Compliance:**
- No governance changes; existing conformance gate applies
- API responses validate against manifest schema
- CLI install respects version-pin constraints

---

## 3. Scope: Parallel Waves (A–D)

### Wave A: Discovery API + Backend Schema (5–7 days)
**Primary:** Codex  
**Deliverables:**
- PostgreSQL schema: skills, versions, ratings, trending metrics, installation_log
- REST API v1 (5 endpoints):
  - `GET /api/v1/skills` — list all (paginated, sortable)
  - `GET /api/v1/skills/search` — fuzzy search by name/category/description
  - `GET /api/v1/skills/{id}` — skill detail + full manifest
  - `GET /api/v1/skills/{id}/versions` — version history + checksums
  - `GET /api/v1/skills/trending` — 30-day install count, rating trend
- Manifest resolver: validate incoming skill metadata against conformance schema
- Version-pin enforcement: ensure install constraints don't conflict
- Analytics ingestion: log skill installs, searches, rating submissions
- Stress test: 10k concurrent reads, 100 concurrent writes (lock fairness test from GATE-04)

**Success:** All 5 endpoints respond <200ms p99; zero LINEAGE_CONFLICT errors under stress

**Output:** OpenAPI spec + database schema + performance baseline

---

### Wave B: Marketplace UI (7–10 days)
**Primary:** Antigravity  
**Deliverables:**
- React SPA: `/marketplace` landing page
  - Browse grid: skill cards (icon, name, category, rating, install count, last update)
  - Search bar: real-time fuzzy search with debounce
  - Filter panel: category, rating (4+/4.5+), install count, update freshness
  - Sort options: trending, rating, newest, alphabetical
- Skill detail page: `/marketplace/skills/{id}`
  - Full manifest display, version history, changelog
  - Version picker + install button
  - Reviews section, rating distribution chart
  - Installation instructions, changelog, dependencies
- Install flow: one-click `npm install`, copy paste, or CLI command
- CLI companion: `toolforge search`, `toolforge info`, `toolforge install --pin=v1.2.0`
- Web + CLI both consume same API; zero UI-specific endpoints

**Success:** <500ms page load, <200ms search response, zero crashes at 500+ skill scale

**Output:** Web artifact + CLI bin with install/search/info commands

---

### Wave C: Advanced Features (5–7 days)
**Primary:** Shared (Codex ratings backend + Antigravity UI)  
**Deliverables:**
- Rating system: 1–5 stars, optional text review, can edit own review
- Trending calculation: 7-day + 30-day install spike detection
- Version pinning: allow `toolforge install skill@1.2.x` constraints
- Install analytics: heatmap by skill + version, adoption curves
- Category taxonomy: standardize skill categories (linting, auth, deploy, docs, ci, etc)
- Deprecation warnings: skills can mark versions as deprecated; UI highlights
- Related skills: "if you use skill X, you might like skill Y" recommendations
- Skill metadata enrichment: owners can add tags, sponsor links, demo URLs

**Success:** 10 dogfood reviewers submit ratings; trending calculation runs daily; no race conditions on concurrent reviews

**Output:** Analytics dashboard (Codex-built, Cast Iron Charlie theme) + rating schema

---

### Wave D: Integration & Perf (3–5 days)
**Primary:** Joint  
**Deliverables:**
- E2E test suite (5 scenarios):
  1. User discovers skill via search
  2. User installs + pins version
  3. User submits rating + review
  4. User updates to new version (respects pinned constraint)
  5. Trending calculation runs without data corruption
- Load test: 50k concurrent users, 1k skills, 100 concurrent installs
- Caching layer: Redis for trending + search results, TTL 1 hour
- Database indexing: optimize search, version lookup, rating aggregation
- Regression test suite vs Phase 8: validator still passes all submissions

**Success:** All 5 E2E scenarios pass; load test p99 latency <300ms; zero state corruption under concurrency

**Output:** Test reports + performance baseline + deployment runbook

---

## 4. Architecture Decisions

### API Modality: REST-first, GraphQL deferred
**Decision:** Versioned REST endpoints (v1, v1.1, v2 as needed).  
**Rationale:** Deterministic schema evolution critical for marketplace stability; easier for plugin authors; cleaner caching. GraphQL added Phase 10 if demand warrants.

### API Scope: Internal-only
**Decision:** API not public in Phase 9; no client SDKs shipped.  
**Rationale:** Ratings/reviews require anti-abuse systems (rate limiting, review moderation, spam detection) not yet chartered. Phase 10 adds those, then go public.

### UI Surface: Web-primary
**Decision:** React SPA as single source of truth; CLI wraps same API, not duplicate code.  
**Rationale:** Fastest iteration, lowest friction for browsing. Desktop client Phase 11.

### Storage: PostgreSQL
**Decision:** Extend existing db schema from Phase 8 validator.  
**Rationale:** ACID guarantees needed for rating consistency; full-text search on skill metadata; join heavy for trending + related skills.

### Version Constraints: SemVer
**Decision:** Install accepts `skill@^1.2.0`, `skill@~1.2.0`, `skill@1.2.0` (exact).  
**Rationale:** Aligns with npm ecosystem; familiar to developers; simplifies version resolver logic.

---

## 5. Team Assignments

| Wave | Component | Owner | Support |
|------|-----------|-------|---------|
| **A** | API (list/search/detail/versions/trending) | Codex | — |
| **A** | Database schema + migrations | Codex | Antigravity code review |
| **A** | Manifest validation + version-pin resolver | Codex | — |
| **B** | Web UI (browse, detail, install flow) | Antigravity | Codex API review |
| **B** | CLI (search/info/install commands) | Antigravity | — |
| **C** | Ratings schema + aggregation backend | Codex | Antigravity UX feedback |
| **C** | Trending calculation + cron job | Codex | — |
| **C** | Rating UI + review submission | Antigravity | Codex backend review |
| **C** | Version pinning UI + constraint enforcement | Shared | — |
| **D** | E2E tests (scenarios 1–5) | Joint | — |
| **D** | Load testing + caching layer | Codex (perf) | Antigravity (UI stress) |
| **D** | Regression suite (Phase 8 compat) | Joint | — |

**Cross-team Sync:** Daily async standup in `#phase9-marketplace` Slack; weekly sync meeting Tue 10am PT.

---

## 6. Gate Definition

**GATE-09-MARKETPLACE** — Marketplace UI + API launch gate

**Pre-gate criteria (Wave A–D complete):**
- [ ] API: all 5 endpoints live, p99 latency <200ms
- [ ] UI: marketplace loads <500ms, search <200ms
- [ ] CLI: install/search/info commands functional
- [ ] Tests: 5/5 E2E scenarios pass; load test p99 <300ms
- [ ] Regression: Phase 8 validator test suite 100% pass
- [ ] Ratings: minimum 10 skills reviewed
- [ ] Docs: API spec (OpenAPI v3) + CLI README + UI deployment guide
- [ ] Zero critical bugs blocking marketplace navigation or install flow

**Post-gate gate deliverable:** Marketplace live at `/marketplace`, API at `/api/v1`, CLI published to npm.

**Gate review:** Tier 1 approval required before public announcement.

---

## 7. Timeline

| Week | Dates | Wave | Milestone |
|------|-------|------|-----------|
| **W1** | Jul 28 – Aug 3 | A | API schema + list/search endpoints live; E2E framework scaffold |
| **W1–W2** | Jul 28 – Aug 10 | B | Web UI alpha (browse + search); CLI alpha (install) |
| **W2** | Aug 4 – 10 | C | Ratings schema + trending calculation; version-pin logic |
| **W3** | Aug 11 – 15 | D | Integration tests + perf tuning; gate review |
| **W3** | Aug 16–26 | — | Post-launch: bug fixes, dogfood feedback, anti-abuse hardening |
| **2026-08-09** | — | — | **Target Delivery** (Wave A–D complete, gate ready) |
| **2026-08-26** | — | — | **Post-launch stabilization** |

---

## 8. Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| **API schema churn** | Breaks UI mid-wave | Medium | Lock schema in Week 1; treat as immutable; use migrations for changes |
| **Search latency @ 1k skills** | UX friction | Medium | Implement Postgres GiST full-text index; load test Week 2 |
| **Rating data race on concurrent writes** | Lost reviews / score corruption | Medium | PostgreSQL ACID; stress test GATE-04 pattern (10 concurrent writers) |
| **UI complexity creep** | Wave B overruns | Medium | Design mockups locked by end of Week 1; no scope changes mid-wave |
| **CLI dependency conflicts** | Install fails for users | Low | Test install against existing Phase 8 + Phase 7 rollback deps |
| **Codex/Antigravity merge conflicts** | Integration delay | Low | Daily sync + separate schema/UI repos; merge early/often |

**Contingency:** If Wave C (ratings) slips, defer to Phase 9.1 (2-week follow-up). Marketplace launches without ratings; can add retroactively without breaking API.

---

## 9. Success Metrics (Post-launch)

**Adoption:**
- Day 1: 100+ skills installed via marketplace
- Day 7: 500+ total installs across skill catalog
- Day 30: Average 50 installs/day, trending calculation accurate

**Quality:**
- Install success rate >98% (failed installs logged, traced)
- Average skill rating >3.5 stars (over 50+ reviewed)
- Zero regressions vs Phase 8 validator

**Performance:**
- API p99 latency stable <200ms under normal load
- UI page load p99 stable <500ms
- Search index rebuild <10 minutes

**User Satisfaction:**
- Dogfood feedback: "browsing skills is easier than before"
- CLI adoption: 30%+ of installs via CLI vs web
- Net Promoter Score (NPS) >40 post-launch

---

## 10. Dependencies & Assumptions

**Dependencies:**
- Phase 8 validator + conformance schema (complete ✅)
- PostgreSQL instance + migrations infrastructure (Phase 8 ✅)
- React + CLI framework setup (existing projects ✅)

**Assumptions:**
- Codex + Antigravity remain staffed at current capacity
- No new governance requirements between now and 2026-08-26
- GATE-04 fairness fix backported to marketplace codebase (non-blocking, can be applied post-launch)
- No Phase 7 rollback incidents that require team context switch

---

## 11. Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| **Tier 1** | Chris Sorensen | 2026-07-14 | ✅ APPROVED |
| **Tier 2 (Codex)** | — | TBD (post-dispatch) | Ready for dispatch |
| **Tier 2 (Antigravity)** | — | TBD (post-dispatch) | Ready for dispatch |

**Gate Closure Authority:** Tier 1 (Tier 2 execution)

---

## Appendix A: API v1 Specification (Summary)

**Base URL:** `https://api.cic-marketplace.internal/api/v1`

```
GET /skills
  Query: page=1, limit=50, sort=trending|rating|newest|alpha
  Response: {skills: [{id, name, category, rating, installs, lastUpdate}], total, page}
  Latency: <100ms (p99)

GET /skills/search
  Query: q=string, category=string, minRating=number
  Response: {results: [{id, name, category, icon, description, rating}], count}
  Latency: <200ms (p99)

GET /skills/{skillId}
  Response: {id, name, description, manifest, rating, reviews: [{author, score, text}], versions}
  Latency: <50ms (p99)

GET /skills/{skillId}/versions
  Response: {versions: [{tag, releaseDate, changelog, checksum}]}
  Latency: <50ms (p99)

GET /skills/trending
  Query: window=7d|30d
  Response: {trending: [{id, name, installCount7d, installCount30d, trend}]}
  Latency: <100ms (p99)
```

---

## Appendix B: CLI Command Reference (Preview)

```bash
toolforge search "linting"
toolforge search "ci" --category=deploy
toolforge info toolforge-linter
toolforge info toolforge-linter --versions
toolforge install toolforge-linter
toolforge install toolforge-linter@^1.2.0 --pin
toolforge list --installed
toolforge update toolforge-linter
```

---

**Next Action:** Tier 1 review + approval. Codex/Antigravity onboarding post-approval.

**Related Charters:** Phase 8 (validator), Phase 7 (rollback). Phase 10 (anti-abuse, GraphQL, public API).

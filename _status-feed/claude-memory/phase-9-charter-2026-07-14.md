---
name: phase-9-charter
description: "Phase 9 Charter locked — marketplace UI + discovery API, 2026-08-09 target, parallel waves A-D"
metadata: 
  node_type: memory
  type: project
  originSessionId: ccf05dba-5b2e-42cb-914e-45473bad602b
---

## Phase 9: Marketplace UI + Discovery API + Advanced Features

**Status:** ✅ APPROVED (Tier 1: Chris Sorensen, 2026-07-14). Ready for team dispatch 2026-07-29.

**Target delivery:** 2026-08-09  
**Gate:** GATE-09-MARKETPLACE (marketplace live, all 5 API endpoints <200ms p99)  
**Team:** Codex + Antigravity (parallel waves)

### Scope: Parallel Waves

**Wave A (5-7 days):** Discovery API + backend schema  
- PostgreSQL schema: skills, versions, ratings, trending_metrics, installation_log
- 5 REST endpoints: list, search, detail, versions, trending
- Manifest resolver, version-pin enforcement, analytics ingestion
- Stress test: GATE-04 fairness pattern (10 concurrent writers)

**Wave B (7-10 days):** Marketplace UI + CLI  
- React SPA: `/marketplace` browse + search + filter + detail pages
- CLI: `toolforge search`, `toolforge info`, `toolforge install --pin=v1.x.x`
- Single API source of truth; zero UI-specific endpoints

**Wave C (5-7 days):** Advanced features  
- Ratings 1-5 stars + text reviews; editing own reviews allowed
- Trending: 7-day + 30-day install spike detection
- Version pinning: SemVer constraints (`^1.2.0`, `~1.2.0`, `1.2.0`)
- Related skills recommendations; category taxonomy

**Wave D (3-5 days):** Integration & performance  
- 5 E2E scenarios: discover → install → rate → update → trending calcs
- Load test: 50k concurrent users, 1k skills, 100 concurrent installs
- Redis caching: trending + search results (1h TTL)
- Regression vs Phase 8 validator (100% pass required)

### Architecture Decisions

- **API modality:** REST-first, versioned (v1, v1.1, v2). GraphQL deferred to Phase 10.
- **API scope:** Internal-only. Anti-abuse systems (rate limiting, moderation) + public SDK = Phase 10.
- **UI surface:** Web-primary. Desktop client Phase 11.
- **Storage:** PostgreSQL (extend Phase 8 schema). ACID for rating consistency; full-text search.
- **Version constraints:** SemVer (aligns npm ecosystem).

### Success Criteria

- API list 50: <100ms (p99); search 1000: <200ms (p99)
- UI browse load: <500ms (p99); search: <200ms (p99)
- All 5 E2E tests pass; zero data races under stress
- Ratings: minimum 10 skills reviewed by dogfooding
- Zero regressions vs Phase 8 validator + CLI install
- Performance baseline: trending calcs <50ms, install analytics ingest <50ms

### Team Assignments

| Wave | Component | Owner | Notes |
|------|-----------|-------|-------|
| A | API + DB schema | Codex | version-pin resolver critical |
| B | Web UI + CLI | Antigravity | single API source of truth |
| C | Ratings backend + UI | Shared | Codex backend, Antigravity UI |
| D | Integration + perf | Joint | stress tests from GATE-04 pattern |

### Risks & Mitigation

- **API schema churn:** Lock schema Week 1; treat immutable; use migrations
- **Search latency @ 1k skills:** Postgres GiST full-text index; load test Week 2
- **Rating race condition:** PostgreSQL ACID; concurrent write stress test
- **UI complexity creep:** Lock mockups Week 1; no scope changes mid-wave
- **Contingency:** Wave C (ratings) can slip to Phase 9.1; marketplace launches read-only

### Post-launch Metrics

- Day 1: 100+ installs; Day 7: 500+ cumulative; Day 30: 50+ daily average
- Install success rate >98%; avg skill rating >3.5 stars (50+ reviewed)
- API p99 <200ms; UI p99 <500ms; zero state corruption

### Charter Location

`CIC-GOVERNANCE/MANIFEST/PHASE-09-CHARTER.md` — commit ede9903, main

### Next

Tier 1 → Codex/Antigravity team onboarding → Wave A starts Monday 2026-07-29

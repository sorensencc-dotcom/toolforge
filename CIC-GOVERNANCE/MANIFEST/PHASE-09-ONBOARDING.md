# Phase 9 Onboarding — Codex + Antigravity
## Effective Date: 2026-07-29

---

## 1. Scope Alignment

**Codex** (Wave A, C primary):
- Discovery API (REST v1): list, search, detail, versions, trending endpoints
- PostgreSQL schema: skills, versions, ratings, trending_metrics, installation_log
- Manifest resolver: validate incoming skill metadata vs conformance schema
- Version-pin resolver: enforce SemVer constraints (^1.2.0, ~1.2.0, 1.2.0)
- Ratings aggregation engine: 1-5 stars + text reviews, edit own review
- Trending calculation: 7-day + 30-day install spike detection, daily cron
- Analytics ingestion: log skill installs, searches, ratings (sub-50ms latency)
- Performance baseline: stress test GATE-04 fairness pattern (10 concurrent writers)

**Antigravity** (Wave B, C secondary):
- Marketplace UI: React SPA at `/marketplace`
  - Browse grid: skill cards (icon, name, category, rating, installs, last-update)
  - Search bar: real-time fuzzy search with debounce
  - Filter panel: category, rating (4+/4.5+), installs, freshness
  - Skill detail page: manifest, versions, changelog, reviews, install CTA
  - Version picker: install dialog with constraint options (exact/^/~)
- CLI commands: `toolforge search`, `toolforge info`, `toolforge install --pin=v1.x.x`, `toolforge list --installed`, `toolforge update`
- Integration tests: 5 E2E scenarios (discover → install → rate → update → trending)
- Performance tuning: Redis caching for trending + search (1h TTL)

**Shared** (Wave C overlap):
- Version-pin logic: Codex backend enforcement, Antigravity UI constraint picker
- Ratings UI + backend: Codex aggregation, Antigravity form + display

---

## 2. Required Artifacts (Read Before 2026-07-29)

| Artifact | Owner | Status | Notes |
|----------|-------|--------|-------|
| **PHASE-09-CHARTER.md** | Tier 1 | ACTIVE | Full scope, timeline, gates, risks. Start here. |
| **REST-v1-OPENAPI-SPEC.md** | Codex | PENDING | Detailed endpoint schema, auth, error codes, examples. |
| **CLI-REFERENCE.md** | Antigravity | PENDING | Command syntax, flags, exit codes, output formats. |
| **GATE-09-MARKETPLACE.md** | Tier 1 | PENDING | Gate criteria, launch checklist, sign-off owners. |
| **MEMORY.md (Phase 9 entries)** | System | ACTIVE | Charter summary, team assignments, timeline. |
| **Phase 8 Charter** | Reference | CLOSED | Marketplace validator + conformance schema (Phase 9 builds on). |

---

## 3. Environment Requirements

**Node.js:**
- Version 20+ (deterministic ESM baseline)
- Explicit `.js` file extensions on all imports
- No bundler; direct file requires

**Services:**
- PostgreSQL 15+ (schema migration infrastructure from Phase 8)
- Redis 7+ (caching layer; optional until Wave D)
- Marketplace registry service (HTTP API, Phase 8 infra)

**Tools:**
- Toolforge manifest validator (v1.4.2+)
- CIC lineage lock enabled (atomic file lock with fairness fix)
- Git hooks: pre-commit, pre-push (existing)

**Access:**
- GitHub: sorensencc-dotcom/toolforge (main branch)
- Database: dev instance (credentials in .env.local)
- Slack: `#phase9-marketplace` (async standup channel)

---

## 4. Kick-off Checklist (2026-07-29)

**All hands (Codex + Antigravity):**
- [ ] Read PHASE-09-CHARTER.md (60 min)
- [ ] Confirm understanding of Wave A/B/C/D boundaries
- [ ] Acknowledge perf targets: p99 <200ms API, <500ms Web
- [ ] Review success criteria: 5/5 E2E pass, zero regressions vs Phase 8
- [ ] Confirm gate sign-off date: 2026-08-09

**Codex (API + backend):**
- [ ] Freeze API schema by end of kickoff; document in REST-v1-OPENAPI-SPEC.md
- [ ] Map PostgreSQL schema additions vs Phase 8 base
- [ ] Identify version-pin constraint logic (SemVer parser location)
- [ ] Plan stress test infrastructure (GATE-04 fairness pattern, 10 concurrent writers)
- [ ] Estimate Wave A interval: 5–7 days

**Antigravity (UI + CLI):**
- [ ] Review REST v1 endpoint previews (in PHASE-09-CHARTER.md appendix)
- [ ] Sketch wireframes: browse grid, detail page, install dialog
- [ ] Lock CLI verb semantics: `search`, `info`, `install`, `list`, `update`
- [ ] Plan E2E infrastructure: 5 test scenarios, headless browser, API mocking vs real
- [ ] Estimate Wave B interval: 7–10 days

**Cross-team (API + UI sync):**
- [ ] Align on response envelope (pagination, error format, metadata)
- [ ] Agree on search query syntax (Lucene vs simple string)
- [ ] Confirm version-pin constraint syntax (`@^1.2.0` vs `@~1.2.0` vs `@1.2.0`)
- [ ] Schedule weekly sync (Tue 10am PT) + async standups (#phase9-marketplace)

---

## 5. Success Criteria (Wave-by-wave)

### Wave A Deliverables (Target: 2026-08-03)
- [ ] PostgreSQL schema live (skills, versions, ratings, trending, logs)
- [ ] API endpoint: `GET /api/v1/skills` (list 50, <100ms p99)
- [ ] API endpoint: `GET /api/v1/skills/search` (1000 skills, <200ms p99)
- [ ] API endpoint: `GET /api/v1/skills/{id}` (detail, <50ms p99)
- [ ] API endpoint: `GET /api/v1/skills/{id}/versions` (version history, <50ms p99)
- [ ] API endpoint: `GET /api/v1/skills/trending` (7d + 30d spikes, <100ms p99)
- [ ] Manifest resolver: validate incoming skill metadata
- [ ] Version-pin resolver: enforce SemVer constraints
- [ ] Stress test: 10 concurrent writers, zero LINEAGE_CONFLICT (fairness fix proven)
- [ ] OpenAPI spec: all 5 endpoints documented with examples

### Wave B Deliverables (Target: 2026-08-10)
- [ ] React SPA: `/marketplace` landing page renders (<500ms p99)
- [ ] Browse grid: skill cards populate from API list endpoint
- [ ] Search bar: real-time search, debounce 300ms, results <200ms (p99)
- [ ] Filter panel: category, rating, installs, freshness filters functional
- [ ] Skill detail page: manifest, versions, reviews, install CTA
- [ ] Install dialog: version picker (exact/^/~), copy-paste + CLI commands
- [ ] CLI: `toolforge search`, `toolforge info`, `toolforge install --pin`
- [ ] Integration test scaffold: 5 scenarios drafted

### Wave C Deliverables (Target: 2026-08-10)
- [ ] Ratings schema: 1-5 stars, text reviews, edit own review
- [ ] Rating aggregation: average, distribution, count, last-updated
- [ ] Trending calculation: 7-day + 30-day install spike, daily cron
- [ ] Version-pin UI: constraint picker in install dialog
- [ ] Version-pin backend: enforce constraints during install
- [ ] Related skills: "if you use X, you might like Y" recommendations
- [ ] Category taxonomy: standardize skill categories (20–30 categories)
- [ ] Deprecation warnings: skills can mark versions deprecated; UI highlights

### Wave D Deliverables (Target: 2026-08-15)
- [ ] E2E test: discover skill via search (pass)
- [ ] E2E test: install + pin version (pass)
- [ ] E2E test: submit rating + review (pass)
- [ ] E2E test: update to new version (respects pin, pass)
- [ ] E2E test: trending calculation runs without data corruption (pass)
- [ ] Load test: 50k concurrent users, 1k skills, 100 concurrent installs, p99 <300ms
- [ ] Caching layer: Redis for trending + search, 1h TTL
- [ ] Database indexing: optimize search, version lookup, rating aggregation
- [ ] Regression suite: Phase 8 validator test suite 100% pass
- [ ] Performance baseline: documented p99 latencies vs targets

---

## 6. Weekly Sync Schedule

**Kickoff:** 2026-07-29 (Mon 10am PT)
- Charter walkthrough, checklist sign-off

**Standups:** Daily async in `#phase9-marketplace` Slack
- Format: `[Wave X] Status: <1-line update> | Blockers: <if any>`
- Examples:
  - `[Wave A] Status: PostgreSQL schema migrated, list endpoint returning 50 skills in 80ms | Blockers: None`
  - `[Wave B] Status: Browse grid wireframe locked, implementing search debounce | Blockers: Waiting for Wave A search endpoint finalized`

**Weekly Sync:** Tue 10am PT (30 min)
- Progress vs Wave targets
- Cross-team blockers (API schema changes, version-pin logic)
- Perf metrics so far (latency, memory, DB query times)
- Risks emerging

**Gate Review:** 2026-08-15 (Tier 1)
- All 5/5 E2E scenarios pass
- Perf baselines documented
- Zero regressions vs Phase 8
- Deployment runbook complete

---

## 7. Known Constraints & Gotchas

**Schema Immutability:**
- Once Wave A schema freezes (by 2026-07-31), treat as immutable for Phase 9
- Version changes only via migrations (no drop-column, rename-table patterns)
- Rationale: ratings/trending data accumulation; breaking schema breaks historical data

**API Versioning:**
- Wave A ships v1 only; no backwards compat layer yet
- If schema changes discovered post-Wave-A, use `POST /api/v1/migrate` endpoint
- GraphQL layer (Phase 10) will decouple schema from API; v1 stays frozen

**Fairness Lock (GATE-04):**
- Stress test uses same fairness pattern as GATE-04 (10 concurrent writers)
- If failures occur, check AtomicFileLock fairness fix is applied to codebase
- Backport if needed; non-blocking, can apply post-launch (Wave D slack)

**Rating Spam Prevention:**
- Phase 9 does NOT implement rate limiting or moderation
- Wave C assumes dogfood (trusted reviewers only)
- Anti-abuse layers (Phase 10): rate limits, review moderation, fraud detection, public API
- Rationale: marketplace launches internal-only; anti-abuse can be added without breaking API

**Version-Pin Conflicts:**
- Resolver must reject impossible constraints (e.g., `^1.0.0` + `~2.0.0`)
- Error message: clear explanation of conflict + both constraint strings
- Test case: attempt to pin incompatible versions; expect 400 Bad Request

---

## 8. Reference Materials

| Document | Audience | Link |
|----------|----------|------|
| **Phase 9 Charter** | All | `CIC-GOVERNANCE/MANIFEST/PHASE-09-CHARTER.md` |
| **Phase 8 Charter** | Reference (validator infra) | `CIC-GOVERNANCE/MANIFEST/PHASE-08-CHARTER.md` |
| **Global Operating Rules v2.0** | Governance | `docs/meta/global-operating-rules-cic-rewrite-labs.md` |
| **Toolforge Marketplace Spec v1.0** | Architecture | `docs/meta/TOOLFORGE-MARKETPLACE-SPEC-v1.0.md` |
| **CIC Governance Manifest** | System state | `CIC-GOVERNANCE/MANIFEST/CIC-GOV-MANIFEST-001.md` |

---

## 9. Post-Kickoff Assignments

**Codex (by 2026-07-30):**
- [ ] Draft PostgreSQL schema migration (Phase 8 baseline)
- [ ] Define REST v1 endpoint contract (OpenAPI spec)
- [ ] Prototype list endpoint (mock data, performance test)
- [ ] Set up stress test infrastructure (GATE-04 fairness pattern)

**Antigravity (by 2026-07-30):**
- [ ] Finalize wireframes: browse, detail, install dialog
- [ ] Lock CLI command semantics (verb + flags)
- [ ] Set up React project structure
- [ ] Draft E2E test skeleton (5 scenarios)

**Both (by 2026-07-31):**
- [ ] Confirm API schema frozen
- [ ] Finalize version-pin constraint syntax
- [ ] Agree on response envelope format
- [ ] Schedule weekly sync recurring

---

**Next:** Wave A kick-off 2026-07-29 (16:00 PT). Push charter + onboarding to main by 2026-07-28 (EOD).

**Tier 1 Approval:** Required before team dispatch. Sign-off date: 2026-07-27.

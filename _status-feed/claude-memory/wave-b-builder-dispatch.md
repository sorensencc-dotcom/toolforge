---
name: wave-b-builder-dispatch-2026-07-12
description: "Wave B builder dispatch briefs — 2 builders, 4 Category B skills, 47 tests total, 2026-07-12 launch (Day 3)"
metadata:
  type: project
  originSessionId: 2c047833-a9dd-49b9-9c7f-f6cbe419fbd3
---

## Wave B Dispatch: Category B Data/State Management

**Timeline:** Days 3–7 (2026-07-12 to 2026-07-16)  
**Builders:** 2 (Builder 4, Builder 5)  
**Skills:** 4 (context-manager, cic-roadmap-updater, reconcile-vector-store, kb-sync-artifact-generator)  
**Target Tests:** 47 total (avg 11.75/skill)  
**Target Coverage:** 80%+ per skill  

---

## Builder 4 Brief

**Assignment:** 2 skills, ~23 tests

### Skill 1: context-manager (13 tests)
- **Purpose:** Session state persistence + recovery
- **Test Categories:**
  - State serialization (4 tests): serialize context to disk, format validation, schema versioning
  - State recovery (4 tests): deserialize with integrity check, corrupt state handling, partial recovery
  - Consistency (5 tests): concurrent mutation detection, parallel update merging, conflict resolution

### Skill 2: cic-roadmap-updater (10 tests)
- **Purpose:** Roadmap state sync + CRUD operations
- **Test Categories:**
  - CRUD operations (5 tests): create roadmap, read phases, update phase status, delete phases, bulk operations
  - Sync logic (3 tests): detect sync conflicts, merge changes, audit trail
  - Validation (2 tests): schema validation, constraint checking

### Success Criteria
- ✅ 23 tests total (target 13 + 10)
- ✅ 80%+ coverage per skill
- ✅ All tests deterministic + isolated
- ✅ No flaky tests
- ✅ Commit to main with message: "test: Wave B Builder 4 — context-manager + cic-roadmap-updater (23 tests, 80%+ coverage)"

### Notes
- Both skills are state-management focused; test shared patterns (serialization, recovery, merging)
- Use existing skill.json specs; no implementation changes needed
- Reference Wave A builders (permission-governor, scale-ingestion-service) for test structure + coverage patterns
- CI: npm test --coverage must report 80%+ for both skills

---

## Builder 5 Brief

**Assignment:** 2 skills, ~24 tests

### Skill 1: reconcile-vector-store (14 tests)
- **Purpose:** Vector DB consistency + embedding validation
- **Test Categories:**
  - Vector operations (6 tests): insert, update, delete, query, bulk operations
  - Embedding validation (4 tests): dimension matching, similarity scoring, NaN handling
  - Consistency checks (4 tests): index synchronization, duplicate detection, recovery after crash

### Skill 2: kb-sync-artifact-generator (10 tests)
- **Purpose:** Knowledge base generation + versioning
- **Test Categories:**
  - Artifact generation (5 tests): generate markdown, HTML, JSON formats, template expansion, metadata
  - Versioning (3 tests): version tracking, changelog generation, rollback capability
  - Schema validation (2 tests): artifact schema, format compliance

### Success Criteria
- ✅ 24 tests total (target 14 + 10)
- ✅ 80%+ coverage per skill
- ✅ All tests deterministic + isolated
- ✅ No flaky tests
- ✅ Commit to main with message: "test: Wave B Builder 5 — reconcile-vector-store + kb-sync-artifact-generator (24 tests, 80%+ coverage)"

### Notes
- reconcile-vector-store: data integrity focus; test edge cases (NaN, inf, precision)
- kb-sync-artifact-generator: document generation focus; test output format validation
- Reference Wave A builders (rewrite-labs-orchestrator) for integration test patterns
- CI: npm test --coverage must report 80%+ for both skills

---

## Dispatch Checklist

- [ ] Builder 4 assigned + briefed
- [ ] Builder 5 assigned + briefed
- [ ] Both builders create test files in skills/*/tests/skill.test.ts
- [ ] npm test --coverage passes for all 4 skills
- [ ] Commits pushed to main (before Wave C start on day 7)
- [ ] Coverage verified (80%+ per skill)
- [ ] Zero flaky tests observed in CI runs

---

## Cross-Skill Integration Points (for Wave C/D testing)

- **context-manager → cic-roadmap-updater:** roadmap state persisted via context-manager
- **kb-sync-artifact-generator → reconcile-vector-store:** artifacts indexed in vector store for semantic search

These integrations will be tested in cross-skill E2E tests (Wave C onwards).

---

## Phase 8 Entry Gate Impact

Wave B completion (47 tests, 80%+ coverage) brings skill ecosystem test coverage to:
- Wave A: 79 tests
- Wave B: 47 tests
- **Running Total:** 126 tests (+47%)
- **Remaining (Waves C+D):** 74+ tests to reach 200+ target

**Tier 1 approval at 2026-07-26 requires:** all 200+ tests passing + 80%+ coverage across all 18 skills.

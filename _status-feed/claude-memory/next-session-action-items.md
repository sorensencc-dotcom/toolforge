---
name: next-session-action-items
description: Priority action items for next session after integration testing setup
metadata: 
  node_type: memory
  type: project
  originSessionId: 5fcd286a-45b4-4e37-8df0-7d777da14d2e
---

**Next Session Action Items**

## Immediate (Session Start)

**1. Run full Docker test suite**
```bash
cd c:\dev
docker-compose up --build --abort-on-container-exit
```

Expected: All 51 tests pass (TorqueQuery 12 + Vault 12 + Repomix 6 + Governance 13 + Unified API 8)

**2. Verify output**
- All services build successfully
- Health checks pass
- Tests complete without hanging
- Log output shows test results

**3. Document results**
- If all pass: mark as production-ready
- If failures: diagnose and fix in Docker environment (not host)

## Strategic (Plan next phase)

**Option A: Phase 29 (Knowledge Graph)**
- Blocked by: Phase 26 TorqueQuery ✅ (complete)
- 3-phase implementation (29 → 30 → 31)
- Starter code ready (skeleton files at phase-29-starter-code-skeletons.md)
- Test matrices defined (phase-29-31-test-matrices.md)
- Architecture locked (phase-29-31-architecture-and-build-blueprint.md)

**Option B: Phase 1 (Planning Engine)**
- Memory indicates Phase 1 complete (92/92 tests passing)
- Phase 2 locked: Harvester v2 + Learning cost model
- Could start Phase 2 if Phase 1 needs hardening

**Option C: Continue Phase 24 (Governance)**
- Phase 24.5 (Build Governance Integration) exists
- Governance evolution loop (Phase 24.2) complete
- Could extend with additional phases 24.6+

## Technical Debt (Optional)

- Merge better-sqlite3 native builds into Docker workflow (tested in this session)
- Add HTTP smoke tests to CI/CD pipeline
- Document Docker-first testing approach in README

## Commits to Watch

- `6590bf9` — Jest configs
- `094af35` — HTTP integration tests
- `cb678db` — Docker infrastructure (latest)

Branch is **10 commits ahead of origin/master** (as of session end).

## Memory References

- [[integration-testing-docker-approach]] — Why Docker-first
- [[testing-jest-config-pattern]] — Jest setup for all services
- [[docker-compose-service-wiring]] — How services are wired
- [[session-2026-06-14-four-phase-queue]] — What was delivered

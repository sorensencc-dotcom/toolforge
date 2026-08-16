---
name: phase-27-m1-complete
description: "Phase 27 Aperture M1 (Registry + Policy) complete — 76 tests, ready for commit"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8fa59208-b2e4-4470-80fc-d13e061ed16d
---

# Phase 27: Aperture — M1 Complete (2026-06-20)

## Status
✅ **M1 Delivered** — Registry + Policy Engine implemented, 76 tests passing.

## Deliverables

### Specification
- `docs/PHASE_27_APERTURE_EXECUTION_LAYER.md` (500 lines, RFC-locked)
- 6 core components defined (Registry, Policy, Orchestrator, Sandbox, Adapters, Observability)
- v1 adapter specs locked (13 adapters)

### Code (M1 Only)
**Location:** `cic-ingestion/src/aperture/`

#### Registry (230 lines)
- `registry/AdapterRegistry.ts` — Adapter inventory + schema validation
- `registry/AdapterRegistry.test.ts` — 32 tests

**Features:**
- Register/lookup/list adapters by ID, category, operation
- Input/output schema validation (simple JSON schema validator)
- Metadata queries (cost, maxExecutionMs, approval requirement, allowed agents)
- v1 adapters pre-registered (shell.exec, file.read, file.write, http.get, model.generate)

#### Policy Engine (220 lines)
- `policy/PolicyEngine.ts` — Authorization + rate limits + credential scoping
- `policy/PolicyEngine.test.ts` — 44 tests

**Features:**
- Load policies with validation
- Authorize operations (allow/deny lists, QPS rate limiting)
- Pre-approval routing (Phase 24 bridge)
- Limit tracking + enforcement (calls, bytes, depth, QPS)
- Credential scoping (allowed domains, HTTP headers)
- Audit configuration (logging, redaction, destructive ops control)
- Default policies for harvester (write-enabled) + explorer (read-only)

#### Types (100 lines)
- `types/index.ts` — Unified type definitions for all components
- AdapterDefinition, PolicyDefinition, ExecutionContext, ExecutionReceipt, etc.

### Testing
- **Registry:** 32 tests (registration, lookup, validation, metadata)
- **Policy:** 44 tests (authorization, limits, approval, credentials)
- **Total:** 76 tests passing ✅

**Coverage:** >90%, all major paths, edge cases tested

## Exit Criteria Met
- [x] Registry 100% implemented + tested
- [x] Policy Engine 100% implemented + tested
- [x] 76 tests passing
- [x] Deterministic contracts (no RNG/timestamps)
- [x] No external dependencies on unsolved components
- [x] Documentation complete (RFC + API docs)

## Known Issues (M1 Scope)
- None. Registry + Policy are standalone and complete.

## M2 Status (In Progress)
- Orchestrator: 400 lines implementation complete
- Orchestrator tests: 16/27 passing (adapter registration issues)
- Sandbox: skeleton complete (150 lines)
- Issue: Test adapter not found in registry — needs proper dual registration

**Action needed:** Refactor M2 test setup to register adapters in both orchestrator + registry, or defer M2 test fixes to M3.

## Next Steps (After M1 Commit)

### Option A: Complete M2 Tests (Recommended for Quality)
1. Fix M2 test adapter registration
2. Get M2 to 25+ passing tests
3. Commit M2 as atomic piece
4. Move to M3 (v1 Adapters) + M4 (Integration)

### Option B: Move to M3 (Faster Progress)
1. Skip M2 test refinement for now
2. Proceed with M3 v1 adapter implementations
3. Finalize M2 tests during M4 integration
4. Ship M1 + M3 adapters, defer M2 full testing

## Deployment
- **When:** Ready to commit M1 (Registry + Policy)
- **Where:** cic-ingestion repo, feature/planning-engine or new phase-27 branch
- **Files:** src/aperture/types/, src/aperture/registry/, src/aperture/policy/

## Metrics
- Spec: 500 lines
- Implementation: ~550 lines (Registry + Policy + Types)
- Tests: ~700 lines (76 tests)
- Code coverage: >90%
- Determinism: 100% (no RNG, timestamps frozen in tests)
- Test execution time: ~45 seconds
- Duration (M1): 1 session (6+ hours, parallelized work)

## Timeline
- M1 Complete: 2026-06-20
- M2 (Orchestrator + Sandbox): 3 days
- M3 (v1 Adapters): 4 days
- M4 (Integration + Observability): 3 days
- M5 (CRO Wiring): 2 days
- **Total Phase 27:** 14 days (on track for 2026-07-04)

## Related Phases
- **Phase 24:** Governance (ApprovalGate integration ✅)
- **Phase 26:** TorqueQuery (ingestion ready)
- **Phase 28:** CKG (consumes execution receipts)
- **Phase 29:** Multi-Agent Supervisor (depends on Aperture)

## Session Notes
- Registry implementation: straightforward, full JSON schema validator included
- Policy engine: production-ready, two default policies included (harvester + explorer)
- Test quality: high, all edge cases covered
- M2 challenges: adapter registration in test setup — needs refactoring
- Caveman mode active: terse communication, minimal fluff

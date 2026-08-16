---
name: phase-26-31-integration-testing
description: 4-phase queue integration testing checkpoint; 19/32 tests passing; native module blocker identified
metadata:
  type: project
---

**Phase 26–31 Integration Testing Checkpoint** 🚧

Commit: `6590bf9` — Integration test infra setup + blocker diagnosis.

## Test Status

| Service | Tests | Status | Notes |
|---------|-------|--------|-------|
| Repomix (Phase 4.4) | 6 | ✅ PASS | All tests green |
| Governance (Phase 24.2) | 13 | ✅ PASS | HTTP cleanup warning only |
| TorqueQuery (Phase 26) | 12 | ❌ BLOCKED | better-sqlite3 native module missing |
| Vault (M3) | 12 | ❌ BLOCKED | better-sqlite3 native module missing |
| Unified API | — | ⏸️ DEFERRED | Depends on TorqueQuery/Vault init |
| **Total** | **43** | **19/43** | **44% coverage** |

## Blocker: better-sqlite3 Native Module

**Problem:** both TorqueQuery and Vault use better-sqlite3 for deterministic SQLite storage. Native module compilation requires Python + node-gyp.

**Environment:** Windows 10 (missing Python)

**Impact:** Database-backed tests cannot run until module resolved.

**Workarounds (pick one):**
1. **Install Python 3.12 + Visual Studio Build Tools** — Full native compilation (recommended for prod)
2. **Use pre-built binaries** — better-sqlite3 ships optional x64 binaries for Windows
3. **Switch to sqlite3 module** — Pure JS SQLite (slower, less deterministic)
4. **Mock database in tests** — Use in-memory mock for CI/test environments, real DB for integration

## Next Moves

**Immediate (Phase 26.1):**
- Resolve better-sqlite3 native module (install Python or use workaround)
- Re-run TorqueQuery + Vault tests (target 12+12=24 tests)
- Verify unified-api server startup and route mounting

**Medium-term (Phase 30):**
- HTTP integration tests across all endpoints
- Data flow test: repo ingest → memory → TorqueQuery → evolution cycle
- Vault audit log verification

**Long-term (Phase 31):**
- End-to-end governance decision flow
- Amendment generation with populated signals
- Policy feedback loop validation

## Docker Integration Testing Solution

**Commit: `cb678db`** — Full Docker infrastructure deployed.

All 5 services now have Dockerfiles + docker-compose wiring:

| Service | Container | Port | Build |
|---------|-----------|------|-------|
| TorqueQuery | node:20 | 3110 | +Python, +build-essential (better-sqlite3) |
| Vault | node:20 | 3111 | +Python, +build-essential (better-sqlite3) |
| Repomix | node:20-alpine | 3112 | Lightweight |
| Governance | node:20-alpine | 3113 | Lightweight |
| Unified API | node:20-alpine | 3100 | Lightweight (depends on all 4) |

**Run full test suite in Docker:**
```bash
cd c:\dev
docker-compose up --build --abort-on-container-exit
```

**What happens:**
1. Each service builds independently (parallel)
2. Python available in TorqueQuery/Vault for native module compilation
3. All tests run automatically: `npm test` in CMD
4. Services depend on each other (unified-api waits for others)
5. Results streamed to stdout

**Expected output:**
- TorqueQuery: 12 tests ✅ (was blocked on Windows)
- Vault: 12 tests ✅ (was blocked on Windows)
- Repomix: 6 tests ✅
- Governance: 13 tests ✅
- Unified API: 8 tests (HTTP integration, requires server up)

## Completed in This Session

✅ Jest config setup (Repomix, Vault, Unified API)
✅ TypeScript type fixes (@types/uuid across all services)
✅ Repomix pipeline: 6/6 tests verified (host machine)
✅ Governance evolution: 13/13 tests verified (host machine)
✅ HTTP integration test suite created
✅ Dockerfiles for all 5 services
✅ Docker Compose service definitions + wiring
✅ Commits logged: 6590bf9 (configs), 094af35 (HTTP tests), cb678db (Docker infra)

## Test Execution Commands

**Run non-blocked tests:**
```bash
cd c:\dev\services\repomix-ingestion && npm test
cd c:\dev\services\cic-governance && npm test
```

**To unblock all tests:**
```bash
# Option A: Install Python for native build
python --version  # Verify 3.12+
cd c:\dev\services\torquequery && npm install  # Rebuild

# Option B: Use pre-built binaries (if available)
npm config set better-sqlite3_use_prebuilt true
```

## Files Modified

- `services/repomix-ingestion/jest.config.js` — Created
- `services/vault/jest.config.js` — Created
- `services/torquequery/src/indexer/MemoryIndexer.ts` — Fixed type assertion for DB query result
- All services: Added @types/uuid dev dependency

## Decision Log

**Caveman Mode:** Full — drop articles/filler, fragments OK, technical precision required.
**Testing Strategy:** Defer database tests until native module resolved; test HTTP APIs separately.
**Approach:** Commit working test infrastructure now; resolve blocker in follow-up phase.

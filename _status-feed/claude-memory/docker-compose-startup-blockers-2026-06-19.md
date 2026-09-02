---
name: docker-compose-startup-blockers-2026-06-19
description: "Docker Compose startup issues discovered 2026-06-19 — path mismatches, ESM imports, .dockerignore. Status: cic-ingestion still crashing on relative imports."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1ee0b6e4-0c3a-45b2-8c7f-de12bcf5c825
---

## Docker Compose Stack Startup Blockers (2026-06-19)

### Status
Running docker-compose with multiple services. Most containers now start, but **cic-ingestion keeps crashing** on missing modules. All fixes below have been applied; last blocker is TypeScript/ESM import path handling.

### Root Cause Chain

**Issue 1: TypeScript output path mismatch** ✅ FIXED
- tsconfig.json had `rootDir: "../"` expecting full monorepo structure
- Dockerfile only copied `cic-ingestion/src`, so paths didn't match
- **Fix:** Changed tsconfig.json `rootDir: "."` → output now `dist/src/*` instead of `dist/cic-ingestion/src/*`
- **Files changed:** cic-ingestion/tsconfig.json, cic-ingestion/Dockerfile (CMD path updated to `dist/src/server.js`)

**Issue 2: Harvester-v2 start script wrong path** ✅ FIXED
- package.json script `start:harvester-v2` referenced `dist/app/src/...` (old path)
- **Fix:** Updated to `dist/src/harvester/v2/server.js`
- **File:** cic-ingestion/package.json line 20

**Issue 3: Planning-console routing error** ✅ FIXED
- Server had no catch-all 404 handler; Express path-to-regexp failed on `*` route pattern
- **Fix:** Added middleware 404 handler (no route matching)
- **File:** rewrite-mcp/src/planning-console/server.js

**Issue 4: PostgreSQL database init missing** ✅ FIXED
- postgres service created `cic_lineage` but services expected `cic` database too
- **Fix:** Created docker-init-db.sql with CREATE DATABASE statements, mounted in docker-compose.yml
- **Files:** docker-init-db.sql (new), docker-compose.yml volumes section

**Issue 5: .dockerignore blocking build context** ✅ FIXED
- Root .dockerignore had line 8: `cic-ingestion`, excluding entire directory from Docker build
- Docker build uses root context (.) so all COPY commands failed with "not found"
- **Fix:** Removed `cic-ingestion` from .dockerignore
- **File:** .dev/.dockerignore

**Issue 6: Dockerfile COPY paths wrong** ✅ FIXED
- Dockerfile used `COPY src ./src` but build context is root, needs `COPY cic-ingestion/src ./src`
- Applied to all COPY commands in builder stage and runtime stage
- **File:** cic-ingestion/Dockerfile

### Remaining Blocker: ESM Module Path Errors

**Current error:** `Cannot find module '/app/dist/src/autonomy/AutonomyService' imported from .../AutonomyAPIServer.js`

**Root cause:** Node.js ESM (package.json: `"type": "module"`) requires explicit `.js` file extensions in relative imports. TypeScript compiled `from './AutonomyService'` → `from './AutonomyService'` (no `.js`), but Node.js ESM can't resolve it.

**Examples of broken imports:**
- AutonomyAPIServer.ts line 12: `from './AutonomyService'` → needs `from './AutonomyService.js'`
- Multiple files in cic-ingestion/src need same fix

**Attempted fix (partial):**
- Added `.js` extensions manually to AutonomyAPIServer.ts imports
- Rebuilt and cic-ingestion still crashes on ObservabilityManager (same issue in another import)
- Need to add `.js` to ALL relative imports across entire cic-ingestion/src tree

**Next steps for new session:**
1. Batch-add `.js` extensions to all `from './*'` patterns in cic-ingestion/src TypeScript files
   - Use sed/find-replace to convert: `from '\./(path)'` → `from '\./(path).js'`
   - Exclude node_modules imports (they don't need .js)
2. Rebuild TypeScript: `cd cic-ingestion && npm run build`
3. Rebuild Docker image: `docker build -f cic-ingestion/Dockerfile --no-cache -t dev-cic-ingestion:latest ..`
4. Restart container: `docker compose up cic-ingestion -d`

### Verified Working Services
- postgres (healthy)
- redis (running)
- torquequery (running)
- planning-engine (running)
- vault (running)
- unified-api (health: starting)

### Files Modified
- c:/dev/cic-ingestion/Dockerfile
- c:/dev/cic-ingestion/package.json
- c:/dev/cic-ingestion/tsconfig.json
- c:/dev/cic-ingestion/src/autonomy/AutonomyAPIServer.ts (partial .js fix)
- c:/dev/docker-compose.yml
- c:/dev/.dockerignore
- c:/dev/rewrite-mcp/src/planning-console/server.js
- c:/dev/docker-init-db.sql (new file)

---
name: integration-testing-docker-approach
description: Docker-first testing strategy for native modules; resolves better-sqlite3 blocker on Windows
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5fcd286a-45b4-4e37-8df0-7d777da14d2e
---

**Decision: Tests in Docker Always**

**Rule:** Run all integration tests in Docker containers, not on host machine.

**Why:** Windows host lacks Python + build tools needed for better-sqlite3 native module compilation. Docker images include full toolchain (node:20 with apt-get for Python, build-essential). Single source of truth: Dockerfile defines test environment, eliminates "works on my machine" problems.

**How to apply:** 
- Every service with native deps (torquequery, vault) gets Dockerfile with `FROM node:20` (not alpine)
- Include `RUN apt-get update && apt-get install -y python3 build-essential`
- Lightweight services (repomix, governance, unified-api) use `node:20-alpine`
- Docker Compose orchestrates full integration test suite
- CI/CD runs `docker-compose up --build --abort-on-container-exit` for all tests

**Testing workflow:**
1. Write tests locally (can't run without Docker)
2. `docker-compose up --build` runs all 51 tests in containers
3. Commit only after Docker tests pass
4. No host environment setup required

**Related:** [[testing-jest-config-pattern]], [[docker-compose-service-wiring]]

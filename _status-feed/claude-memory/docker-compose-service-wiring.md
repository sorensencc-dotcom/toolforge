---
name: docker-compose-service-wiring
description: Docker Compose pattern for multi-service integration testing
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5fcd286a-45b4-4e37-8df0-7d777da14d2e
---

**Docker Compose Service Wiring Pattern**

Services added to `docker-compose.yml` with standard template:

```yaml
service-name:
  build:
    context: .
    dockerfile: services/service-name/Dockerfile
  container_name: service-name
  restart: unless-stopped
  environment:
    - NODE_ENV=test
    - LOG_LEVEL=info
    - PORT=3110
    - SERVICE_URL=http://dependency:3111
  ports:
    - "3110:3110"
  depends_on:
    - dependency-service
  networks:
    - cic-network
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3110/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 10s
```

**Key patterns:**
- `build.context: .` — relative to repo root, not service directory
- `build.dockerfile: services/*/Dockerfile` — explicit path to each service's Dockerfile
- `NODE_ENV=test` — ensures test scripts run (npm test in CMD)
- `PORT` env var — overridable per service
- `depends_on` — ensures startup order (unified-api last, depends on all others)
- `healthcheck` — validates service is up before dependent tests start
- `networks: cic-network` — all services on same network for inter-service communication

**Services in this session:**
- torquequery:3110 (TorqueQuery)
- vault:3111 (M3 Persistent Vault)
- repomix-ingestion:3112 (Repomix Integration)
- cic-governance:3113 (Governance Evolution)
- unified-api:3100 (depends on all 4, routes all requests)

**Run command:**
```bash
docker-compose up --build --abort-on-container-exit
```

**Expected behavior:**
- All services build in parallel (Docker optimizes)
- Services start based on `depends_on` order
- Healthchecks verify readiness before dependent services start
- Tests run in CMD (npm test)
- Process exits when first service exits or all complete successfully

**Ports used:**
- 3100: Unified API (main entry point)
- 3110-3113: Individual services (for direct testing if needed)

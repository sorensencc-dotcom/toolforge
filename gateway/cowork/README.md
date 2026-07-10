# Cowork Gateway — Phase 3.B Mock Integration

Toolforge's bridge to Cowork plugin network. Manages skill registration, manifest export, and distributed sync for all 22 operational skills (13 Phase 1 + 9 Phase 2 Tier A).

**Status:** Mock Cowork server + E2E test suite complete. Real external Cowork API integration remains a future step.

## Quick Start

```bash
# Install dependencies
npm install

# Copy .env.example to .env and configure (mock server defaults provided)
cp .env.example .env

# Start mock Cowork server (in one terminal)
npm run mock:server

# In another terminal: run tests
npm test

# Build
npm run build
```

**Mock Server:** Listens on `http://127.0.0.1:4790`. No real external Cowork service required for local development.

## Architecture

### Modules

- **`client/`** — Cowork API client (auth, HTTP, retries)
- **`registry/`** — Skill registry, manifest builder, registration manager
- **`sync/`** — Sync protocol, state tracking, drift detection
- **`utils/`** — Logging, error classes, environment validation

### Flow

```
SkillRegistry.load()
    ↓
ManifestBuilder.buildGatewayManifest()
    ↓
CoworkClient.registerSkill() [for each unregistered]
    ↓
RegistrationManager.registerUnregistered()
    ↓
SyncCoordinator.syncState()
    ↓
CoworkClient.getGatewayStatus()
```

## Phase 3.A–B Tasks

**Phase 3.A (Scaffolding):**

- [x] Cowork API client (CoworkHttp, CoworkAuth, CoworkClient)
- [x] Skill registry (SkillRegistry, ManifestBuilder)
- [x] Registration manager (RegistrationManager)
- [x] Sync protocol & coordinator (SyncProtocol, SyncState, SyncCoordinator)
- [x] Gateway metadata (gateway.json)
- [x] Test scaffolding (client.test.ts, registry.test.ts, sync.test.ts)
- [x] Main entrypoint (index.ts)

**Phase 3.B (Mock Integration & E2E Tests):**

- [x] Endpoint path reconciliation (gateway.json ↔ CoworkClient)
- [x] New client methods: `pullManifestHash()`, `heartbeat()`
- [x] SkillRegistry underscore-prefix filtering (_TEMPLATE exclusion)
- [x] Mock Cowork server (mock-server/)
- [x] .env.example with mock server defaults
- [x] Real test suite (53→100+ real assertions, no stubs)
- [x] Internal API reference doc (cowork-mock-api.md)

**Future:**

- [ ] Real external Cowork API integration (blocked on endpoint spec + credentials)
- [ ] CI/CD pipeline wiring

## Environment Variables

```
COWORK_API_URL          # Cowork API base URL
COWORK_API_KEY          # Bearer token for Cowork
COWORK_GATEWAY_ID       # Gateway identifier (toolforge-gateway)
COWORK_SYNC_INTERVAL    # Sync interval in seconds (default: 300)
TOOLFORGE_SKILLS_PATH   # Path to toolforge/skills directory
```

## API Reference

**For full mock Cowork endpoint specification, see [Cowork Mock API](../../docs/gateway/cowork-mock-api.md).**

### CoworkClient

```typescript
// Register skill
await client.registerSkill({
  id: 'agent-drift-detector',
  name: 'Agent Drift Detector',
  version: '1.0.0',
  category: 'validation',
  entrypoint: 'src/index.ts'
});

// Push manifest
await client.pushManifest(manifest);

// Sync state
await client.syncState({
  gateway_id: 'toolforge-gateway',
  last_sync: new Date().toISOString(),
  skills_registered: 9,
  drift_detected: false
});

// Get status
await client.getGatewayStatus();

// Get manifest hash
await client.pullManifestHash();

// Send heartbeat
await client.heartbeat();
```

### SkillRegistry

```typescript
const registry = new SkillRegistry(skillsPath);
await registry.load();

registry.getAll();                    // All 22 skills
registry.getByStatus('registered');   // Registered only
registry.getById('skill-id');         // Single skill
registry.count();                     // Total count
registry.countRegistered();           // Registered count
```

### ManifestBuilder

```typescript
const builder = new ManifestBuilder('toolforge-gateway', '1.0.0');
const manifest = builder.buildGatewayManifest(skills);
const json = builder.toJSON(manifest);
```

### RegistrationManager

```typescript
const manager = new RegistrationManager(client);
const results = await manager.registerUnregistered(skills);

manager.getSuccessful();   // Successful registrations
manager.getFailed();       // Failed registrations
manager.allSucceeded();    // Boolean: all passed?
```

### SyncCoordinator

```typescript
const coordinator = new SyncCoordinator('toolforge-gateway', client);

await coordinator.handshake(['skill-registration', 'distributed-sync'], 22);
await coordinator.syncState(9, 9);
coordinator.detectDrift(expectedHash, actualHash);
await coordinator.getGatewayStatus();
```

## Error Handling

All errors inherit from `CoworkError`:

- `RegistrationError` — Skill registration failed
- `SyncError` — State sync or status check failed
- `ManifestError` — Manifest validation failed
- `AuthError` — Authentication failure
- `NetworkError` — HTTP/network error (retryable)

Example:

```typescript
try {
  await client.registerSkill(manifest);
} catch (error) {
  if (error instanceof RegistrationError) {
    console.error(`Registration failed for ${error.skillId}: ${error.message}`);
  }
}
```

## Logging

Structured JSON logging via `Logger` class:

```
{"logger":"CoworkClient","timestamp":"2026-07-10T16:30:00Z","level":"info","message":"Skill registered","context":{"skillId":"agent-drift-detector","pluginId":"plugin_xyz"}}
```

## Validation

### Manifest Schema

- gateway: string (non-empty)
- skills: array (non-empty)
  - id: string (lowercase, hyphens)
  - name: string (non-empty)
  - version: string (semver)
  - category: string (non-empty)
  - entrypoint: string (file path)
  - registered: boolean

### Sync Message Schema

- id: string (non-empty)
- gateway_id: string (non-empty)
- timestamp: string (ISO 8601)
- version: string (non-empty)
- payload: object
- type: SyncMessageType (enum)

## Status

**Phase 3.A:** ✅ Scaffolding Complete  
**Phase 3.B:** ✅ Mock Integration + E2E Tests Complete

Mock Cowork server deployed. All 22 skills can be registered, manifest pushed, state synced, heartbeat sent, and status checked via local mock API.

**Adoption of real external Cowork API** remains a separate future step, blocked on an actual endpoint spec + credentials (see [Phase 3 Scope Charter](../../docs/meta/phase-3-scope-charter.md)).

## Next Steps

1. Run test suite: `npm test` (all tests should PASS)
2. Start mock server: `npm run mock:server`
3. Integration: point gateway at mock server via `.env`
4. When real Cowork API spec is available: update `CoworkClient` endpoints and authentication

---

**Gateway Version:** 1.0.0  
**Status:** TIER1_APPROVED  
**Last Updated:** 2026-07-10

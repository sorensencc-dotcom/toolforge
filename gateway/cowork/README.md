# Cowork Gateway — Phase 3.A Implementation

Toolforge's bridge to Cowork plugin network. Manages skill registration, manifest export, and distributed sync for all 22 operational skills (13 Phase 1 + 9 Phase 2 Tier A).

## Quick Start

```bash
# Install dependencies
npm install

# Set environment
export COWORK_API_URL=https://api.cowork.ai
export COWORK_API_KEY=<your-api-key>
export COWORK_GATEWAY_ID=toolforge-gateway
export TOOLFORGE_SKILLS_PATH=C:\dev\toolforge\skills

# Run gateway initialization
npm run gateway:init

# Run tests
npm test

# Build
npm run build
```

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

## Phase 3.A Tasks

- [x] Cowork API client (CoworkHttp, CoworkAuth, CoworkClient)
- [x] Skill registry (SkillRegistry, ManifestBuilder)
- [x] Registration manager (RegistrationManager)
- [x] Sync protocol & coordinator (SyncProtocol, SyncState, SyncCoordinator)
- [x] Gateway metadata (gateway.json)
- [x] Test scaffolding (client.test.ts, registry.test.ts, sync.test.ts)
- [x] Main entrypoint (index.ts)
- [ ] Actual API integration (awaiting Cowork endpoint spec)
- [ ] E2E test execution
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
**Awaiting:** Cowork API endpoint specification + Tier 1 approval

## Next Steps

1. Obtain Cowork API endpoint + auth details
2. Implement mock Cowork server for testing
3. Run end-to-end test suite
4. Proceed with Phase 3.B (distributed sync pipeline)

---

**Gateway Version:** 1.0.0  
**Status:** TIER1_APPROVED  
**Last Updated:** 2026-07-10

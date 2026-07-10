---
title: Cowork Mock API Specification
summary: Internal-only mock HTTP API for Phase 3.B testing. No external Cowork API exists yet.
created: 2026-07-10
updated: 2026-07-10
tags: cowork, mock, gateway, phase-3, testing, internal
---

# Cowork Mock API Specification

**Status:** INTERNAL MOCK ONLY  
**Version:** 1.0.0  
**Base URL (Local):** `http://localhost:4790`  
**Authentication:** Bearer token via `Authorization` header  

---

## ⚠️ Important Notice

**This is an internal mock API specification.** No real external Cowork API exists yet. This specification documents the mock server built for Phase 3.B testing only.

When Cowork provides a real external API specification, it **will replace this mock entirely**. Phase 3.C will bind to the real API once the specification is delivered.

See [Phase 3.C Kickoff Charter](phase-3c-kickoff-charter.md) for production binding plan.

---

## Overview

The mock Cowork server implements 6 canonical HTTP endpoints with Bearer token authentication, in-memory state, and fault injection for testing retry/timeout logic.

**Endpoints:**
- `POST /v1/skills/register` — Register single skill
- `POST /v1/manifests/push` — Push gateway manifest
- `GET /v1/manifests/hash` — Retrieve current manifest hash
- `PATCH /v1/sync/state` — Sync gateway state
- `POST /v1/gateways/heartbeat` — Send heartbeat
- `GET /v1/gateways/status` — Check gateway status

**Design Principles:**
- All endpoints require `Authorization: Bearer <apiKey>` header
- Request/response payloads are JSON
- Returns 401 for auth failure, 422 for invalid payload, 500 for server errors
- Supports exponential backoff: 100ms, 300ms, 1000ms for 5xx/429 retries
- No external dependencies; fully in-process

---

## Authentication

All requests must include Bearer token:

```http
Authorization: Bearer <apiKey>
```

**Request validation:**
- Missing header → 401 Unauthorized
- Invalid/expired key → 401 Unauthorized
- Valid key → Request proceeds

**Example:**
```bash
curl -H "Authorization: Bearer mock-api-key-1234567890ab" \
  http://localhost:4790/v1/gateways/status
```

---

## Endpoints

### 1. Register Skill

Register a single skill with Cowork.

**Request:**
```http
POST /v1/skills/register
Content-Type: application/json
Authorization: Bearer <apiKey>

{
  "skill_id": "token-burn-analyzer",
  "skill_name": "Analyze Token Burn",
  "version": "1.0.0",
  "category": "observability",
  "integrations": {
    "cowork": {
      "registered": false,
      "plugin_id": null
    }
  }
}
```

**Response (200 OK):**
```json
{
  "plugin_id": "plugin_token-burn-analyzer_v1",
  "skill_id": "token-burn-analyzer",
  "status": "registered",
  "registered_at": "2026-07-10T12:34:56.789Z"
}
```

**Response (422 Unprocessable Entity):**
```json
{
  "error": "skill_id is required",
  "code": 422
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid API key",
  "code": 401
}
```

**Response (500 Server Error - Retryable):**
```json
{
  "error": "Internal server error",
  "code": 500,
  "retry_after": 100
}
```

---

### 2. Push Manifest

Push the gateway's full skill manifest to Cowork.

**Request:**
```http
POST /v1/manifests/push
Content-Type: application/json
Authorization: Bearer <apiKey>

{
  "gateway_id": "toolforge-gateway",
  "manifest": {
    "skills": [
      {
        "id": "token-burn-analyzer",
        "name": "Analyze Token Burn",
        "version": "1.0.0",
        "category": "observability"
      },
      ...
    ],
    "total": 22,
    "timestamp": "2026-07-10T12:34:56.789Z"
  }
}
```

**Response (200 OK):**
```json
{
  "manifest_id": "manifest_toolforge-gateway_202607101234",
  "gateway_id": "toolforge-gateway",
  "skills_count": 22,
  "hash": "abcd1234efgh5678",
  "stored_at": "2026-07-10T12:34:56.789Z"
}
```

**Response (422 Unprocessable Entity):**
```json
{
  "error": "manifest.skills is required",
  "code": 422
}
```

**Response (500 Server Error - Retryable):**
```json
{
  "error": "Failed to store manifest",
  "code": 500
}
```

---

### 3. Pull Manifest Hash

Retrieve the current manifest hash for drift detection.

**Request:**
```http
GET /v1/manifests/hash
Authorization: Bearer <apiKey>
```

**Response (200 OK):**
```json
{
  "gateway": "toolforge-gateway",
  "hash": "abcd1234efgh5678",
  "updated_at": "2026-07-10T12:34:56.789Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "No manifest found for gateway",
  "code": 404
}
```

**Response (500 Server Error - Retryable):**
```json
{
  "error": "Failed to retrieve hash",
  "code": 500
}
```

---

### 4. Sync Gateway State

Synchronize gateway state (skills registered, active, drift signals).

**Request:**
```http
PATCH /v1/sync/state
Content-Type: application/json
Authorization: Bearer <apiKey>

{
  "gateway_id": "toolforge-gateway",
  "last_sync": "2026-07-10T12:34:56.789Z",
  "skills_registered": 22,
  "drift_detected": false
}
```

**Response (200 OK):**
```json
{
  "sync_id": "sync_202607101234_abc123",
  "gateway_id": "toolforge-gateway",
  "ack": true,
  "synced_at": "2026-07-10T12:34:56.789Z"
}
```

**Response (422 Unprocessable Entity):**
```json
{
  "error": "skills_registered is required",
  "code": 422
}
```

**Response (500 Server Error - Retryable):**
```json
{
  "error": "Failed to sync state",
  "code": 500
}
```

---

### 5. Send Heartbeat

Send periodic heartbeat to keep gateway alive.

**Request:**
```http
POST /v1/gateways/heartbeat
Content-Type: application/json
Authorization: Bearer <apiKey>

{
  "gateway_id": "toolforge-gateway",
  "timestamp": "2026-07-10T12:34:56.789Z"
}
```

**Response (200 OK):**
```json
{
  "status": "acknowledged",
  "gateway_id": "toolforge-gateway",
  "received_at": "2026-07-10T12:34:56.789Z"
}
```

**Response (422 Unprocessable Entity):**
```json
{
  "error": "gateway_id is required",
  "code": 422
}
```

**Response (500 Server Error - Retryable):**
```json
{
  "error": "Failed to process heartbeat",
  "code": 500
}
```

---

### 6. Check Gateway Status

Get current gateway status and health.

**Request:**
```http
GET /v1/gateways/status
Authorization: Bearer <apiKey>
```

**Response (200 OK):**
```json
{
  "status": "online",
  "gateway_id": "toolforge-gateway",
  "skills_active": 22,
  "last_heartbeat": "2026-07-10T12:34:56.789Z",
  "uptime_seconds": 3600
}
```

**Response (500 Server Error - Retryable):**
```json
{
  "error": "Failed to retrieve status",
  "code": 500
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Retry? | Example |
|------|---------|--------|---------|
| 200 | Success | N/A | Skill registered |
| 400 | Bad Request | ❌ No | Malformed JSON |
| 401 | Unauthorized | ❌ No | Invalid API key |
| 422 | Unprocessable Entity | ❌ No | Missing required field |
| 429 | Too Many Requests | ✅ Yes | Rate limit exceeded |
| 500 | Server Error | ✅ Yes | Internal error |
| 503 | Service Unavailable | ✅ Yes | Maintenance |

### Retry Strategy

Client uses exponential backoff for retryable errors (5xx, 429):

1. First retry: 100ms delay
2. Second retry: 300ms delay
3. Third retry: 1000ms delay
4. Max 3 attempts total

Non-retryable errors (4xx except 429) fail immediately.

---

## Testing: Fault Injection

The mock server supports fault injection for testing error scenarios.

**Via Test Helper:**

```typescript
// In test setup
const context = getMockServerContext();

// Force 500 error on next 2 calls to /v1/skills/register
context.state.faultInjection.set('/v1/skills/register', {
  forceStatus: { code: 500, count: 2 }
});

// Force 1000ms delay on all calls to /v1/sync/state
context.state.faultInjection.set('/v1/sync/state', {
  forceDelayMs: 1000
});

// Test retry logic
const client = new CoworkClient(context.baseUrl, context.apiKey);
const result = await client.registerSkill(skillData);
// Client retries twice, succeeds on third attempt
```

**Fault Injection Options:**

```typescript
interface FaultInjectionConfig {
  forceStatus?: { code: number; count: number };  // Return this status code N times
  forceDelayMs?: number;                           // Add delay before responding
  forceError?: Error;                              // Throw this error
}
```

---

## Running the Mock Server

**Standalone:**

```bash
cd C:\dev\toolforge\gateway\cowork
npm install
npm run mock:server
# Mock server listening at http://127.0.0.1:4790
```

**In Tests:**

```typescript
import { initMockServer, getMockServerContext, shutdownMockServer } from './tests/helpers/mockServer';

describe('Cowork Integration', () => {
  beforeAll(async () => {
    await initMockServer();
  });

  afterAll(async () => {
    await shutdownMockServer();
  });

  it('should register skill', async () => {
    const context = getMockServerContext();
    const client = new CoworkClient(context.baseUrl, context.apiKey);
    const result = await client.registerSkill({...});
    expect(result.plugin_id).toBeDefined();
  });
});
```

---

## Configuration

**Environment Variables:**

```bash
COWORK_API_URL=http://127.0.0.1:4790      # Mock server URL
COWORK_API_KEY=mock-api-key-1234567890ab  # Mock API key
COWORK_GATEWAY_ID=toolforge-gateway       # Gateway identifier
COWORK_SYNC_INTERVAL=300                  # Sync interval (seconds)
TOOLFORGE_SKILLS_PATH=../../skills         # Skills directory path
```

**See:** `.env.example` for complete template.

---

## See Also

- [Phase 3 Scope Charter](phase-3-scope-charter.md) — Full Phase 3 requirements
- [Phase 3.C Kickoff Charter](phase-3c-kickoff-charter.md) — Real API binding plan + prerequisites
- [Cowork Gateway README](../../toolforge/gateway/cowork/README.md) — Implementation details
- [CIC Governance](../CLAUDE.md) — Project governance rules

---

**Last Updated:** 2026-07-10  
**Internal Use Only:** This specification will be replaced when real Cowork API spec is provided.

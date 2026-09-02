---
name: agent-panel-backend-complete
description: Agents API server (port 3118) implemented; frontend hooks wired; ready for E2E testing
metadata:
  type: project
---

# Agent Panel Backend Complete

**Commit:** 92a2a88
**Date:** 2026-06-25
**Status:** ✅ Agents API live; frontend hooks wired

## Deliverables

### Agents API Server (port 3118)
- `src/server/agentsAPI.ts` — Express server with 9 endpoints
- Mock data initialized from `src/mocks/agents.ts`
- In-memory state for agent operations

### Endpoints Implemented
- `GET /api/agents` → `{ agents: [...] }`
- `GET /api/agents/{id}` → agent detail + config + system
- `GET /api/agents/{id}/logs?limit=100` → `{ logs: [...] }`
- `GET /api/agents/{id}/executions?limit=100` → `{ executions: [...] }`
- `POST /api/agents/{id}/invoke` → returns executionId
- `POST /api/agents/{id}/pause` → sets status: offline
- `POST /api/agents/{id}/restart` → sets status: starting
- `POST /api/agents/{id}/snapshot` → returns snapshotId
- `POST /api/agents/snapshot` → snapshot all agents

### Frontend Hooks (Already Wired)
- `useAgentList.ts` — calls GET /api/agents with 5s polling
- `useAgent.ts` — calls GET /api/agents/{id}, /logs, /executions; POST invoke/pause/restart/snapshot
- Fallback to mocks on API error
- Env var: `REACT_APP_AGENTS_ENDPOINT` (default: localhost:3118)

### Package Scripts
- `npm run agents-api:dev` — start agents API
- `npm run console-api:dev` — start console API (port 3100, already exists)

## Testing Verified
- GET /api/agents ✓ returns 5 agents
- GET /api/agents/agent-1 ✓ returns detail with config + system
- Server handles 404 on unknown agent
- Response formats match hook expectations

## Next Steps

### 1. E2E Test (Frontend + Backend)
```bash
# Terminal 1
npm run agents-api:dev

# Terminal 2
npm run storybook  # http://localhost:6006

# Browse to: Agents Panel story
# Verify: cards render with live data, polling updates every 5s
```

### 2. Test Actions
- Click "Snapshot All" button → verify POST succeeds
- Click pause/restart on agent card → verify status changes

### 3. ConsoleV3 API (if not already wired)
May need similar endpoints on port 3100:
- GET /health
- GET /pipelines
- GET /alerts

(Check if `src/server/consoleAPI.ts` is complete; it exists but may need startup in package.json)

## Known Gaps
- WebSocket subscriptions not yet implemented (TODOs in hooks)
- POST body for invoke currently empty (skill/payload need UI wiring)
- No database persistence (in-memory only)

## File Locations
- API: `src/server/agentsAPI.ts`
- Hooks: `src/hooks/useAgent.ts`, `useAgentList.ts`
- Types: `src/types/agents.ts`
- Mocks: `src/mocks/agents.ts`

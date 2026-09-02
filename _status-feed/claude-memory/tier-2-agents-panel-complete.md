---
name: tier-2-agents-panel-complete
description: "Tier 2 Agents Panel spec complete; UI + backend tracks ready for parallel execution. Next: choose implementation path."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3102c79a-d8e1-4a69-b60f-164c89700b9f
---

## Tier 2: Agents Panel — Complete Build Package

**Status:** Spec locked. Ready for implementation. 2026-06-20.

### Deliverables

**16 Files Generated:**

Components (10):
- AgentsPanel.tsx (main container)
- PanelHeader.tsx, PanelBody.tsx, AgentList.tsx, AgentDetailView.tsx
- AgentMetadata.tsx, AgentHeartbeat.tsx, AgentCostTimeline.tsx, AgentExecutionLog.tsx
- AgentApprovalHistory.tsx, AgentSkillUsage.tsx

Hooks (2):
- useAgentList.ts (polling)
- useAgent.ts (polling + WS ready)

Types & Docs:
- types.ts (all interfaces)
- WIRING.md (API contract)
- WEBSOCKET_WIRING.md (backend WS plan)
- README.md (checklist)
- BUILD_PLAN.md (timeline)

**Location:** `c:\dev\rewrite-mcp\projects\cic-operator-console\src\panels\agents\`

**Total LOC:** ~3050 (1900 code, 1150 docs)

### Key Architecture

- **Polling:** 5s intervals, no backend blocking
- **WebSocket:** Ready (hooks configurable, UI zero-refactor when backend wires)
- **Design:** 100% CIC token-compliant (no hardcoded colors/spacing)
- **TypeScript:** All interfaces strict, no `any`

### Parallel Tracks

**UI Track (3–4 hours):**
- Implement 10 component skeletons
- Wire hooks + polling
- Test with `/api/agents` endpoints (already exist)

**Backend Track (2–3 hours):**
- Implement `/ws/agents` + `/ws/agents/{id}` endpoints
- Wire event broadcasts (status, metrics, logs)
- Test with wscat

**No blocking:** UI works with polling only. WS enhances when ready.

### Next Session Options

1. **Start UI implementation** — build all 10 components + wire hooks
2. **Start backend WS** — implement WebSocket server + event streams
3. **Both parallel** — divide team, execute both tracks simultaneously
4. **Skip to Alerts panel** — different design, lower complexity, Agents dependency satisfied

### Success Criteria

✅ Specs complete
✅ No ambiguity (BUILD_PLAN.md, WIRING.md, WEBSOCKET_WIRING.md all explicit)
✅ All endpoints documented (GET /api/agents, GET /api/agents/:id, PATCH /api/agents/:id/config)
✅ All event schemas defined (agent.status, agent.metrics, agent.log)
✅ Component checklists ready
✅ Implementation team can start immediately

### Related

- [[console-v3-dashboard-layout-complete]] — Tier 1 panels locked
- [[phase-27-aperture-review]] — runtime context

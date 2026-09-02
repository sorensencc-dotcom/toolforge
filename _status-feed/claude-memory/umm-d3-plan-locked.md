---
name: umm-d3-plan-locked
description: "Unified Memory Model (UMM) D3 execution plan locked; 25 tasks, 5 phases, 7-10 days"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddddbec3-4021-4d31-918b-d8c5be3eab51
---

# UMM D3 Plan Locked (2026-06-19)

## Status
**Ready to execute Phase 1, Task 1.1.1** — create `/workspace` root with 9 subdirectories.

Plan file: `c:\dev\PLAN_UMM_D3.md` (complete, locked)

## Decisions Made

### Infrastructure
- **Workspace location:** Local `/workspace` (canonical) synced to OneDrive (Copilot read-only)
- **Operator:** Solo (Chris Sorensen)
- **Timeline:** MVP in 7–10 days
- **Existing:** Copilot Desktop, Antigravity, Claude Desktop, local LLMs, CIC Phase 26 baseline all ready
- **Spark:** Skip (Gemini convenience, not core)
- **CIC autonomy:** Medium (execute ingest/enrich/analyze/log/synthesize; ask for architecture/spec/roadmap/agent changes)

### Execution Order
```
Phase 1 (Days 1–2): Workspace scaffold
  ↓
Phase 2 (Days 2–3): Copilot Memory mapping
  ↓
Phase 3 (Days 3–5): Handoff protocol + daily loop
  ↓
Phase 4 (Days 5–6): CIC autonomy charter
  ↓
Phase 5 (Days 6–8): Governance audit layer
```

## Five Phases Overview

### Phase 1: Workspace Scaffold
- Create 9 folders: projects, roadmaps, specs, architecture, agents, cli, logs, snapshots, scratch
- Lock naming conventions: `name.vMAJOR.MINOR.PATCH.md`
- Initialize empty roadmaps + agent registries
- Create workspace README
- **Success:** All folders exist, pure scaffolding, no code yet

### Phase 2: Copilot Memory
- Define Copilot Memory schema (what it stores)
- Populate operator identity (Chris Sorensen profile)
- Map all 31 CIC phases (Phase 1–26 completed, Phase 27–31 planned)
- Map Rewrite Labs architecture
- Map CIC governance model
- Lock model routing hierarchy
- **Success:** Copilot Memory is source of truth for all task shaping

### Phase 3: Cross-Model Handoff
- Document Copilot → Antigravity handoff
- Document Copilot → Claude handoff
- Document Claude → Antigravity handoff
- Document Local LLMs deterministic transforms
- Document Copilot → CIC autonomous execution
- Create comprehensive daily loop document
- Generate Operator Playbook artifact
- **Success:** All handoffs locked, no ambiguity, playbook is daily reference

### Phase 4: CIC Autonomy Charter
- Define CIC authority boundaries (what it can/can't do)
- Populate agent registries (CIC agents, Rewrite Labs agents)
- Lock CIC execution policies (when it runs autonomously vs waits for approval)
- **Success:** CIC scope crystal clear, no surprises

### Phase 5: Governance Audit Layer
- Define drift detection rules
- Define conflict resolution hierarchy (Copilot Memory > Workspace > Claude > Antigravity > Local LLMs > CIC)
- Define rollback procedures
- Define snapshot procedures
- Create master governance document
- Initialize audit logs
- **Success:** System is auditable, drift-detectable, rollback-capable

## Key Artifacts (to be created)

**Phase 1:**
- `/workspace/specs/NAMING_CONVENTIONS.v1.0.0.md`
- `/workspace/specs/CLI_TRANSCRIPT_PATTERN.v1.0.0.md`
- `/workspace/specs/LOG_ENTRY_FORMAT.v1.0.0.md`
- `/workspace/README.md`

**Phase 2:**
- `/workspace/specs/COPILOT_MEMORY_SCHEMA.v1.0.0.md`
- Copilot Memory entries (in workspace)

**Phase 3:**
- `/workspace/specs/HANDOFF_COPILOT_ANTIGRAVITY.v1.0.0.md`
- `/workspace/specs/HANDOFF_COPILOT_CLAUDE.v1.0.0.md`
- `/workspace/specs/HANDOFF_LOCAL_LLMS.v1.0.0.md`
- `/workspace/specs/HANDOFF_COPILOT_CIC.v1.0.0.md`
- `/workspace/specs/DAILY_LOOP.v1.0.0.md`
- `/workspace/specs/OPERATOR_PLAYBOOK.v1.0.0.md`

**Phase 4:**
- `/workspace/specs/CIC_AUTONOMY_CHARTER.v1.0.0.md`
- `/workspace/specs/AGENT_REGISTRY_SCHEMA.v1.0.0.json`
- `/workspace/agents/cic-agents-registry.v1.0.0.json`
- `/workspace/agents/rewrite-labs-agents-registry.v1.0.0.json`
- `/workspace/specs/CIC_EXECUTION_POLICIES.v1.0.0.md`

**Phase 5:**
- `/workspace/specs/DRIFT_DETECTION_RULES.v1.0.0.md`
- `/workspace/specs/CONFLICT_RESOLUTION_HIERARCHY.v1.0.0.md`
- `/workspace/specs/ROLLBACK_PROCEDURES.v1.0.0.md`
- `/workspace/specs/SNAPSHOT_PROCEDURES.v1.0.0.md`
- `/workspace/specs/UMM_GOVERNANCE.v1.0.0.md`
- `/workspace/logs/workspace-changes.log` (initialized)
- `/workspace/logs/cic-events.log` (initialized)
- `/workspace/logs/agents-events.log` (initialized)

## Next Session

Start with Phase 1, Task 1.1.1:
```
Create c:\workspace with 9 subdirectories:
  - projects
  - roadmaps
  - specs
  - architecture
  - agents
  - cli
  - logs
  - snapshots
  - scratch
```

Then continue through Phase 1 milestones (naming conventions, empty registries, README).

## Context Links

- Full plan: `c:\dev\PLAN_UMM_D3.md`
- Operator Playbook design (from this session): Shared Workspace Structure + Cross-Model Routing Rules + Daily Loop
- Related: [[phase-26-torquequery-enhancements.md]]
- Related: [[batch-approval-system-complete.md]]

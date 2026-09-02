---
name: rewrite-labs-ir-toolkit-v1
description: IR Toolkit v1.0.0 for Rewrite Labs (schema, planner, agents, outreach); production-ready, 48 files, 4700+ LOC, 45 tests
metadata: 
  node_type: memory
  type: project
  originSessionId: 2f953854-cc9c-43b7-80f7-a990b691b168
---

# Rewrite Labs IR Toolkit v1.0.0

**Completed:** 2024-01-15 | **Status:** Production-ready, skill-enabled, Docker-ready

**Commits:** Docker 25bf202, Skills b725071, Registry f8649a9

**Artifacts:** 48 files, 4700+ LOC, 45 tests passing

## Architecture

**Five subsystems:**

1. **IR Schema v1.0.0** — Website extraction canonical format
   - Meta: URL, date, version
   - Design tokens: colors, spacing, fonts, radii, shadows, z-index, transitions
   - Layout: routes, hierarchy
   - Components: specs, states, breakpoints, assets
   - Assets: images, videos, SVGs

2. **Planner** — Routes IR to 5 tools
   - `planRewriteRun()` orchestrator
   - Redesign (component prioritization)
   - Audit (visual + structural checks)
   - Accessibility (WCAG 2.1 AA)
   - Outreach (email, report, deck)
   - Migration (7-phase roadmap)

3. **Agent Packs** — 6 deterministic prompts
   - Component redesign
   - Layout redesign
   - Visual audit
   - Structural audit
   - Accessibility audit (WCAG)
   - Migration strategy

4. **Outreach Templates** — 3 copy-paste templates
   - Email pitch (context → short-form)
   - Executive report (metrics + ROI)
   - Pitch deck outline (slides + notes)

5. **Tests** — 45 tests (Jest + Vitest)
   - Schema validation
   - Planner routing
   - Agent prompt generation
   - Outreach template rendering
   - E2E (IR → agent → artifact)

## Key Files

```
src/
  schema/
    ir-schema.ts (320) — IR type defs + Zod validators
    design-tokens.ts (180) — Token extraction
  planner/
    planner.ts (280) — Main orchestrator
    redesign-planner.ts (140)
    audit-planner.ts (160)
    accessibility-planner.ts (150)
    migration-planner.ts (120)
  agents/
    redesign-agent.ts (110)
    audit-agent.ts (120)
    accessibility-agent.ts (130)
    migration-agent.ts (140)
  outreach/
    email-template.ts (80)
    report-template.ts (110)
    deck-template.ts (100)

tests/ (45 tests, >80% coverage)
docker/
  Dockerfile (multi-stage)
  docker-compose.yml
.claude/skills/
  SKILL.md (registered + discoverable)
  SKILLPACK.md (packed for distribution)
```

## Capabilities

✅ Parse extracted website JSON → IR schema  
✅ Plan redesign, audit, accessibility, outreach, migration  
✅ Generate agent prompts (deterministic)  
✅ Render outreach templates (email, report, deck)  
✅ Validate IR against schema (Zod)  
✅ Run E2E: IR → plan → agents → artifacts  

## Production Readiness

✅ All 45 tests passing  
✅ >80% code coverage  
✅ Docker image (multi-stage, optimized)  
✅ Skill registered + discoverable  
✅ Error handling on all paths  
✅ Logging + observability  
✅ Documentation (inline + README)  

## Deployment

```bash
# Containerized
docker-compose up

# Or native
npm install && npm test && npm start
```

## Next Steps

- Phase 4.3: Integrate CodeBurn telemetry
- Phase 4.4: Repomix ingestion bridge
- Phase 26: TorqueQuery integration
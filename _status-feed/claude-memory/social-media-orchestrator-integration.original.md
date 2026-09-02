---
name: social-media-orchestrator-phase23-integration
description: Hybrid integration (Extractor + MCP Tool + Skill Node) locked for Phase 23.2 wiring
metadata: 
  node_type: memory
  type: project
  originSessionId: 80a4074f-aa58-4ca1-a930-4beeb6f0691c
---

# Social Media Orchestrator — Phase 23.2 Integration (LOCKED)

**Decision Date:** 2026-06-07  
**Status:** Integration plan written, ready for Phase 23.2 implementation (2026-06-07 → 2026-06-14)

## The Three Locked Decisions

1. **Scope:** Full Hybrid (Extractor + MCP Tool + Skill Graph Node)
2. **Priority:** Phase 23.2 — integrate at Harvester telemetry wiring  
3. **Documentary Context:** General capability + Sorensen-specific presets

## What This Means

The Social Media Orchestrator (deterministic scraper for 10+ platforms: Instagram, TikTok, YouTube, LinkedIn, Twitter, Reddit, Facebook, Telegram, Pinterest, Google Maps) will:

- **Be a CIC Phase 1 Extractor** → every `fetchProfile()`, `fetchPosts()`, `searchContent()` creates a `PLATFORM_EXTRACTION` memory event
- **Expose as Claude MCP Tool** → researchers in Claude Code can call it directly; calls are logged to memory
- **Register as Skill Graph Node** (Phase 24) → APR (Phase 25) can route documentary research tasks to it automatically
- **Drive Long-Horizon Autonomy** (Phase 23.7) → memory-driven proposals detect patterns, suggest platform expansions, rate limit fixes, etc.

## Key Deliverables (Phase 23.2)

1. Memory event schema: `PLATFORM_EXTRACTION` with documentary context scoring
2. Phase 1 integration hook: `runSocialMediaExtraction()`
3. MCP server + Claude Code registration
4. Weekly/monthly synthesizer hooks for trend detection
5. Sorensen-specific harvest presets + scheduler
6. Autonomy proposal generator (memory-driven)

## Timeline

- 2026-06-07: Integration plan locked ✅
- 2026-06-07 → 2026-06-14: Implementation (7 days)
  - Day 1: Memory schema + validation
  - Day 2: Phase 1 integration
  - Day 3: MCP server + Claude Code wiring
  - Day 4–5: Synthesizers + autonomy
  - Day 6: Sorensen presets + E2E testing
  - Day 7: Docs + CLAUDE.md updates

## Sorensen-Specific Harvests

Pre-configured daily/weekly harvests:
- Ford Motor Company (Instagram, Twitter)
- Willow Run Aircraft Factory (YouTube)
- Detroit Industrial Heritage (Twitter, Reddit)
- Sorensen Personal Legacy (Reddit)
- Danish Industrial Archives (Google Maps)

Each harvest includes:
- Query list
- Documentary tags
- Expected keywords for matching
- Historical relevance scoring
- Automatic memory event creation

## Why This Works

- **Deterministic:** No hidden behavior; all calls logged
- **Observable:** Every extraction becomes a memory event (90-day raw + permanent summaries)
- **Autonomous:** Phase 23 synthesizers detect patterns; Phase 25 APR uses patterns to route tasks
- **Sorensen-focused:** Harvests automatically score historical relevance; memory layer tracks what's been found
- **Future-proof:** Skill Graph (Phase 24) and Autonomy (Phase 25) can build on this foundation

## Integration Plan Location

Full spec: `c:\dev\rewrite-mcp\docs\cic\SOCIAL_MEDIA_ORCHESTRATOR_INTEGRATION.md`

Covers:
- Memory event schema (JSON)
- Phase 1 extractor hook
- MCP tool definitions
- Skill Graph node YAML
- Weekly/monthly synthesizer hooks
- Sorensen harvest presets
- Autonomy proposal generator
- Risk mitigation

**Status:** Ready for Phase 23.2 implementation.

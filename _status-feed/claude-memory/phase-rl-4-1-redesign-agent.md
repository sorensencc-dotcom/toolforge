---
name: phase-rl-4-1-redesign-agent
description: RL-4.1 RedesignAgent 3-pass LLM chain + DesignVariantRenderer — shipped commit 70d6789
metadata:
  type: project
---

RL-4.1 shipped: `RedesignAgent` 3-pass Anthropic chain in `packages/agents/src/redesign/redesign-agent.ts`.

**Why:** Unblocked by RL-4.1 PlaywrightExtractor real browser engine (commit bb295d4); extraction pipeline now returns real `PlaywrightDomModel`.

**How to apply:** RedesignAgent accepts optional `client?: Anthropic` constructor arg for DI-based testing (avoids `jest.unstable_mockModule` ESM-only API unavailable in ts-jest CJS mode). Pass 1 → structure analysis JSON, Pass 2 → CSS token layout JSON, Pass 3 → variant generation with 3 HTML/CSS variants. `RedesignNotConfiguredError` thrown when `ANTHROPIC_API_KEY` not set and no injected client.

Key details:
- Token drift score: 0 = all source token VALUES in generated CSS; 1 = fully diverged; gate ≤0.15
- W3C validation: checks DOCTYPE, `lang` attr on `<html>`, `<title>`, `charset` meta; strict mode adds viewport
- `DesignVariantRenderer` in `packages/ir-toolkit/src/design-variant-renderer/index.ts` — standalone, no dep on `@cic/agents`; `renderAll()` returns `BatchRenderResult` with `meetsThreshold` gate
- Test infra fix: added `tsconfig: { types: ['node', 'jest'] }` to ir-toolkit jest.config.js — fixed jest 30 globals for ALL 152 ir-toolkit tests
- 22 agent tests + 25 ir-toolkit tests; grand total after this phase: 230/230 passing

Commits: `70d6789` (implementation), `d85bf55` (follow-on RL-4.2)

[[phase-rl-4-2-wcag-audit]]

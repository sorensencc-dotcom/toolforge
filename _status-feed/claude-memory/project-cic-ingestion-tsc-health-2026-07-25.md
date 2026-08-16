---
name: project-cic-ingestion-tsc-health-2026-07-25
description: "cic-ingestion has ~130 pre-existing tsc --noEmit errors beyond the DOM-lib fix; missing deps + missing local modules + one API-drift test, not a quick cleanup."
metadata: 
  node_type: memory
  type: project
  originSessionId: 47da2b69-f21c-4825-afc7-f62ba763fc94
  modified: 2026-07-26T00:42:34.600Z
---

`npx tsc --noEmit` in cic-ingestion surfaced 200 errors 2026-07-25 while verifying a Codex-authored PNG-format test (`src/__tests__/imageAnalysis.test.ts`, 11/11 pass, legit). Fixed one bucket: `tsconfig.json` `lib: ["ES2022"]` had no DOM typings, so the global `crypto` object was untyped — added `"DOM"` to `lib`, dropped errors 200→138 (commit `05fa1b4d`).

Remaining 138 are NOT one problem:
- **Missing packages**: `@anthropic-ai/sdk`, `puppeteer`, `@types/pg` not installed but imported (`AnthropicClient.ts`, `PuppeteerEngine.ts`, `htmlToPdf.ts`, `GovernanceEnvelopeCache.ts`, `MetricsEngine.ts`, `NightlyMetricsPipeline.ts`, `PrometheusExporter.ts`).
- **Missing local modules**: `src/server/cicStateStore.ts` and `governance/audit-policy.ts` are imported but don't exist on disk (`daemon.ts`, `daemon-routing.ts`, `driftEngine.ts`).
- **Real API drift**: `src/tests/phase4-governance-e2e.test.ts` calls `canaryEngine.executeCanary(proposal)` (6 call sites) but `CanaryEngine` (`src/governance/canary-engine.ts:48`) only has `execute(proposal, approval)` — different name, different arity, sync not async. Dispatched to Codex 2026-07-25 scoped to just this file; not yet verified fixed.
- Assorted implicit-`any` and type-mismatch noise in `autonomy/`, `drift/`, `governance/index.ts` (duplicate `AuditRecord` export).

**Why:** none of this touches the imageAnalysis work — confirmed no imageAnalysis-related errors before committing the tsconfig fix. But it means "full TypeScript build" has been broken in this repo for a while beyond what any one task will surface.

**How to apply:** don't hand the full 138 to any single agent as one task — it's at least 3 unrelated fixes (dep install, restore/stub missing modules, test-vs-API reconciliation). Before claiming cic-ingestion "builds clean," always check whether this backlog was ever paid down; check the 3 buckets above haven't grown. Related: [[feedback_verify_fix_by_running_not_reading]].

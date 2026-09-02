---
name: phase-4-4-repomix-integration
description: Phase 4.4 Repomix Integration — deterministic repo ingestion for Rewrite Labs Harvester + CIC bridge
metadata: 
  node_type: memory
  type: project
  phase: 4.4
  status: execution
  execution: 2026-06-07 through 2026-06-14
  originSessionId: 5e2176b3-377c-4b06-9916-ae546f69dd10
---

# Phase 4.4 — Repomix Integration

**Execution:** 2026-06-07 through 2026-06-14 (1 week)

**Goal:** Deterministic repo snapshot ingestion for Rewrite Labs Harvester + CIC bridge

## Architecture

**Two bridges:**

1. **Rewrite Labs Bridge**
   - Snapshot repo → Repomix JSON
   - Extract design tokens, components, dependencies
   - Feed IR Toolkit (Phase 4.4 IR schema)
   - Detect regressions (component changes, breaking deps)

2. **CIC Bridge**
   - Snapshot → governance packet
   - Track repo state (build info, versions, commits)
   - Detect drift (code quality, dependency versions)
   - Feed governance (lineage, evidence)

## Repomix Integration

```typescript
class RepomixBridge {
  async snapshotRepo(repoPath: string): Promise<RepoSnapshot>
  async extractDesignTokens(snapshot): Promise<DesignTokens>
  async extractComponents(snapshot): Promise<Component[]>
  async detectRegressions(prev, curr): Promise<Regression[]>
}
```

**Input:** Local git repo

**Output:** Deterministic JSON snapshot
- Tree structure
- File contents (code, config, metadata)
- Checksums (detect changes)
- Timestamps

## Rewrite Labs Integration

```typescript
class RewriteLabsRepomixBridge {
  async ingestRepo(snapshot): Promise<IRSchema>
  // Map components → design tokens
  // Build component tree
  // Detect regressions (breaking changes)
}
```

## CIC Integration

```typescript
class CICRepomixBridge {
  async emitLineagePacket(snapshot, changes): Promise<LineagePacket>
  // Track state change
  // Emit governance packet
  // Feed memory store
}
```

## Tests

- Snapshot determinism ✓
- Token extraction ✓
- Component detection ✓
- Regression detection ✓
- Bridge integration ✓
- E2E (repo → IR + governance) ✓

## Files

```
src/repomix/
  RepomixBridge.ts (200)
  RewriteLabsRepomixBridge.ts (150)
  CICRepomixBridge.ts (140)
  
tests/
  RepomixBridge.test.ts
  Integration.test.ts
```

## Success Criteria ✅

✅ Deterministic snapshots
✅ Token extraction working
✅ Component detection working
✅ Regression detection working
✅ Both bridges (Rewrite Labs + CIC)
✅ Tests >80%

## Timeline

- Jun 7–9: Snapshot + extraction
- Jun 10–12: Bridge integration
- Jun 13–14: Tests + hardening

## Ready for

- Rewrite Labs Phase 4.5+ (component redesign)
- CIC Phase 24 governance integration
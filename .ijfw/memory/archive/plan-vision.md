# CIC Vision Subsystem (cic-vision-governance) — Implementation Plan

**Status:** APPROVED Tier 1 (Method A: Gemini API)  
**Timeline:** This session  
**Scope:** Full scaffold + TDD implementation + tests + commit

---

## Tasks (Dependency Order)

### T1: Scaffold Directory Structure
- Create `C:\dev\cic-vision-governance/` root
- Create subdirs: `artifacts/threshold/`, `schema/`, `wrapper/`, `lineage/`, `ratification/`
- Create README.md placeholder
- Success: Dirs exist, no files yet

### T2: Define JSON Schemas
- Create `schema/CIC-VISION-THRESHOLD.schema.json` (artifact schema from spec)
- Create `schema/lineage-log.schema.json` (lineage append-only log)
- Create `schema/provider-stats.schema.json` (provider chain stats)
- Success: Schemas validate, `additionalProperties: false` on closed objects

### T3: Unit Tests — AdaptiveThreshold
- File: `src/harvester/external/vision/__tests__/adaptiveThreshold.test.ts`
- Tests: moving average, bounds enforcement, weighted calculation, determinism
- Success: 8–12 tests PASS

### T4: Implement AdaptiveThreshold
- File: `src/harvester/external/vision/adaptiveThreshold.ts`
- Code to spec; pass all tests from T3
- Success: All tests PASS

### T5: Unit Tests — visionAdapter (hybrid pipeline)
- File: `src/harvester/external/vision/__tests__/visionAdapter.test.ts`
- Tests: provider chain order, fallback on low confidence, Google API call, result merge
- Success: 12–16 tests PASS

### T6: Implement visionAdapter
- File: `src/harvester/external/vision/visionAdapter.ts`
- Hybrid CLIP→BLIP→DINO→SAM→Google pipeline
- Method A: Gemini API key from env
- Success: All tests PASS

### T7: Unit Tests — Pending Artifact Writer
- File: `cic-vision-governance/ratification/__tests__/writePendingThresholdArtifact.test.ts`
- Tests: artifact generation, schema validation, file write, lineage entry
- Success: 6–8 tests PASS

### T8: Implement Pending Artifact Writer
- File: `cic-vision-governance/wrapper/vision-governance-wrapper.ts`
- Exports `writePendingThresholdArtifact()`, validates against schema
- Success: All tests PASS

### T9: Unit Tests — Ratification Tool
- File: `cic-vision-governance/ratification/__tests__/ratify-threshold.test.ts`
- Tests: load artifact, validate actor, update status, append lineage, save
- Success: 6–8 tests PASS

### T10: Implement Ratification Tool
- File: `cic-vision-governance/ratification/ratify-threshold.ts`
- Exports `ratifyThreshold(artifactId, actor)`, validates actor matches executor
- Success: All tests PASS

### T11: Integration Tests — Full Pipeline
- File: `src/harvester/external/vision/__tests__/vision-integration.test.ts`
- Tests: end-to-end threshold update → pending artifact → ratification → active
- Success: 4–6 tests PASS

### T12: Fill Spec Gaps
- Lineage-log schema + examples
- Version scheme: monotonic integer (v001, v002, ...)
- Pending artifact TTL: 30 days (cleanup task, future)
- Ratification fallback: document single-actor pattern + escalation procedure
- Provider failure: document fallback beyond Google (error thrown, logged, no retry)
- Success: Spec complete + consistent with implementation

### T13: Wire into Harvester
- File: `src/harvester/external/vision/index.ts`
- Export `analyzeImage()`, load threshold on startup, wire adaptive updates
- Success: Harvester can import and call vision pipeline

### T14: Commit & Push
- Commit message: "feat: Add CIC Vision Subsystem (cic-vision-governance) with adaptive thresholding and Gemini API"
- Files: all new dirs, all test files, all implementation, updated spec
- Success: Clean push, no CI blocks

---

## Test Summary
- AdaptiveThreshold: 8–12 tests
- visionAdapter: 12–16 tests
- PendingArtifactWriter: 6–8 tests
- RatifyThreshold: 6–8 tests
- Integration: 4–6 tests
- **Total: 36–50 tests PASS**

---

## Exit Criteria
✅ All unit + integration tests PASS  
✅ Spec gaps filled (lineage, versioning, TTL, fallback)  
✅ Code compiles + passes linter  
✅ Committed + pushed  
✅ TRM boundary enforced (no images/metadata/scores to TRM)

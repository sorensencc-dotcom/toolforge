# Viking Reporting Specification v1.0

**Status:** Approved spec
**Date:** 2026-09-05
**Scope:** `viking://` L0 / L1 / L2 Protocol Reporting & Telemetry

## Purpose

This specification defines the deterministic dynamic reporting protocol for Viking VFS operations (`vfs_read_file`, `viking/read`, `viking/stat`, `viking/list`, `viking/readBatch`). Dynamic reporting closes the loop between token economics, latency behavior, cache-prefix stability, context-window protection, and agent mode alignment.

## Invariants

1. **Deterministic Telemetry**: Every read/stat/list operation must produce a standardized `VikingReport` payload.
2. **Fail-Closed Reporting Integrity**: If a VFS operation succeeds, the generated report must strictly pass schema validation against `VikingReportSchema`. If validation fails, the server must abort and return `VIKING_REPORT_INVALID` (-32005), never returning partial telemetry or corrupted payloads.
3. **No Physical Path Leakage**: Reporting payloads must reference canonical `viking://` URIs and relative snapshot paths; physical absolute paths are strictly forbidden.

## Metrics Definition

### 1. Token Delta & Savings
- `tokens_loaded`: Estimated tokens for the payload resolved at the requested tier.
- `tokens_saved_vs_L2`: Difference in tokens between raw L2 content and the loaded tier (0 if L2 was requested).
- `percent_reduction`: Percentage token reduction relative to L2 (\(\frac{\text{saved}}{\text{L2}} \times 100\)).

### 2. Cache Behavior
- `cache_effect`: Categorization of cache impact:
  - `preserved`: Requested tier reuse maintains cache prefix integrity.
  - `extended`: Clean append to cached context without invalidating earlier tokens.
  - `invalidated`: Cache prefix broken due to out-of-order or stale source loading.
  - `fragmented`: Mixed tier reads causing non-contiguous caching.

### 3. Mode Alignment
- `mode_choice_correct`: Boolean verifying whether the selected tier matches the stated task mode:
  - `exploration`: Prefers L0 or L1.
  - `audit`: Prefers L0 -> L1 -> L2 escalation.
  - `refactor`: Prefers L2.
  - `hotfix`: Prefers L2.

### 4. Context Window Pressure
- `context_window_pressure`:
  - `current_tokens`: Context estimate in tokens.
  - `usage_pct`: Percentage of window utilized.
  - `risk_level`: `low` (<50%), `medium` (50-75%), `high` (75-90%), `critical` (>90%).

### 5. Model-Tier Suitability
- `model_tier_suitability`: `optimal`, `acceptable`, `suboptimal`, `degraded` based on target model capability vs resolution tier.

### 6. Roundtrip Avoidance Score
- `roundtrip_avoidance_score`:
  - `0`: Optimal (no unnecessary roundtrips).
  - `1`: Minor inefficiency.
  - `2+`: Hesitation loop / repetitive tier escalation.

## Reporting Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "VikingReport",
  "type": "object",
  "required": [
    "tier",
    "uri",
    "tokens_loaded",
    "tokens_saved_vs_L2",
    "percent_reduction",
    "cache_effect",
    "mode_choice_correct",
    "context_window_pressure",
    "model_tier_suitability",
    "roundtrip_avoidance_score"
  ],
  "properties": {
    "tier": { "type": "string", "enum": ["L0", "L1", "L2"] },
    "uri": { "type": "string" },
    "tokens_loaded": { "type": "integer", "minimum": 0 },
    "tokens_saved_vs_L2": { "type": "integer", "minimum": 0 },
    "percent_reduction": { "type": "number", "minimum": 0.0, "maximum": 100.0 },
    "cache_effect": { "type": "string", "enum": ["preserved", "extended", "invalidated", "fragmented"] },
    "mode_choice_correct": { "type": "boolean" },
    "context_window_pressure": {
      "type": "object",
      "required": ["usage_pct", "risk_level"],
      "properties": {
        "current_tokens": { "type": "integer", "minimum": 0 },
        "usage_pct": { "type": "number", "minimum": 0.0, "maximum": 100.0 },
        "risk_level": { "type": "string", "enum": ["low", "medium", "high", "critical"] }
      }
    },
    "model_tier_suitability": { "type": "string", "enum": ["optimal", "acceptable", "suboptimal", "degraded"] },
    "roundtrip_avoidance_score": { "type": "integer", "minimum": 0, "maximum": 3 },
    "latency_estimate_ms": { "type": "number", "minimum": 0.0 }
  }
}
```

## Compact Markdown Template

```markdown
<!-- viking://report -->
| Metric | Value | Status |
|---|---|---|
| Tier / URI | `{tier}` ({uri}) | OK |
| Tokens | {tokens_loaded} (saved {tokens_saved_vs_L2} vs L2, -{percent_reduction}%) | Optimal |
| Cache Effect | `{cache_effect}` | Stable |
| Context Risk | {usage_pct}% (`{risk_level}`) | Safe |
| Mode Alignment | {mode} -> {tier} | Correct |
| Model Suitability | {model} -> {suitability} | OK |
| Avoidance Score | {roundtrip_avoidance_score} | Deterministic |
```

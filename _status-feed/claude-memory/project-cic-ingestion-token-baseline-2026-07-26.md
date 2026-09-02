---
name: project-cic-ingestion-token-baseline-2026-07-26
description: created cic-ingestion/.ijfw/metrics/baseline.json to track per-session token/cost growth against a 10% flag threshold
metadata: 
  node_type: memory
  type: project
  originSessionId: 0a494a8b-02a6-43ca-9ef9-72788e831d5a
  modified: 2026-07-26T14:13:06.597Z
---

`.context/retros/*.json` schema (commit/LOC metrics only) has no token/cost fields, so there was no baseline file to catch runaway token growth across turns within a session. Real data in `cic-ingestion/.ijfw/metrics/sessions.jsonl` showed session 1 (2026-07-19) growing output_tokens 110,675 → 570,026 and cost $1.78 → $11.96 across 5 turns in one session — a 415% increase with no compaction/reset triggered.

**Why:** No baseline existed to compare against, so this kind of runaway growth goes unnoticed until cost is already high.

**How to apply:** `C:\dev\cic-ingestion\.ijfw\metrics\baseline.json` now tracks turn-1 vs turn-N token/cost per session_id with a `flag_threshold_pct: 10`. When reviewing new sessions in that project, compare against this file; growth beyond 10% turn-over-turn without an intervening compaction is a signal to check for context bloat or a stuck loop, not routine variance.

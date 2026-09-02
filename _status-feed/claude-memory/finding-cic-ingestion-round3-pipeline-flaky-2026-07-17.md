---
name: finding-cic-ingestion-round3-pipeline-flaky-2026-07-17
description: "cic-ingestion round 3 — hashing genuinely fixed, but \"19/19 PASS\" claim falsified by independent run (enforcement_harness timeout race); 2 items ignored 2 rounds running"
metadata: 
  node_type: memory
  type: project
  originSessionId: 43186584-9fe7-4ccc-86ff-7210873adc78
---

Follow-up to [[finding-cic-ingestion-round2-progress-2026-07-17]]. Round 3 fix report claimed 19/19 PASS 0 failed. Independent re-review actually ran the pipeline and got FAIL on `enforcement_harness.ts`.

**Root cause of false PASS claim:** `enforcement_harness.ts` nests 6 sub-spawns of `ts-node/esm` inside the outer `runTool()`'s 60000ms timeout (`_runtime.ts:17`). Nested spawn chain can exceed outer timeout under load, gets killed, registers as FAIL. Ran PASS in isolation, FAIL as part of full pipeline — non-deterministic, not a real fix.

**Genuinely fixed this round:** artifact_immutability.ts + lineage_lock.ts now compute real sha256, manifest.hashes populated with verified-correct values (checked against actual sha256sum). 4 previously-stub tools (continuous_test_generator, treatment_regression_harness, ingestion_deterministic_replay_harness, orchestrate_ingestion_pipeline) gained real structural checks.

**Still ignored across 2 rounds (round 2 AND round 3, unaddressed both times):**
- `runtime/sessions.json` still `{"sessions":[]}`, `governance/amendments.json` still `{"amendments":[]}` no events key — 3 validators (multi_actor_concurrency_validator, activation_ratification_pipeline, governance_closure_sequencer) have real logic that has literally never executed its fail branch.
- `drift_auto_patcher.ts` still ignores `manifest.hashes`, path-drift only, despite hashes now being populated and ready to use.

**Why this matters:** implementer report language ("seeded lineage, quarantine, ingestion replay records") was true but conspicuously silent on sessions/amendments — worth noting reports can be accurate-but-incomplete rather than false; still requires independent verification every round, not trust of the prose summary alone.

**How to apply:** round 4 instructions written to `C:/dev/cic-ingestion/CODEX_FIX_INSTRUCTIONS.md` — require 3x consecutive pipeline runs with consistent results before trusting "N/N PASS" again, and require break→fail→restore→pass proof for the repeat-flagged validators. If round 4 still doesn't touch sessions.json/amendments.json, escalate — 2 rounds of silent omission on the same file is a pattern, not an oversight.

---
name: finding-cic-ingestion-round4-pipeline-verified-2026-07-17
description: "cic-ingestion round 4 — pipeline PASS claim now independently reproduced 3x (reversal of round 3's falsified claim); only sessions.json multi-actor seed still unaddressed, 3rd round flagged"
metadata: 
  node_type: memory
  type: project
  originSessionId: 43186584-9fe7-4ccc-86ff-7210873adc78
---

Follow-up to [[finding-cic-ingestion-round3-pipeline-flaky-2026-07-17]]. Round 4 verified largely real, biggest deal: independent reviewer ran full pipeline 3x themselves (`node --loader ts-node/esm tools/run_full_pipeline.ts`), got PASS/PASS/PASS, byte-identical output each run, 19 tools each. This directly reverses round 3 where the same check caught a false claim.

**Genuinely fixed this round:** timeout race mitigated (60000→120000ms shared default, ~2.3x margin now on enforcement_harness's 6 nested spawns — not structurally eliminated but empirically stable), `governance/amendments.json` real ratified amendment with correct opened→reviewed→closed events + valid signer, `drift_auto_patcher.ts` now reads `manifest.hashes` for real content-drift detection.

**Only remaining gap:** `runtime/sessions.json` still ships with exactly 1 session — `multi_actor_concurrency_validator.ts`'s CONFLICT branch structurally unreachable. This is the 3rd consecutive round (2, 3, 4) this exact item was flagged. Round 4's break/fail/restore/pass proof was real as a transient test but reverted to the vacuous 1-session state instead of leaving a real 2+-session seed committed.

**Why this pattern matters:** demonstrates a recurring failure mode — implementer proves a check works via a temporary manual mutation, then reverts to the original (unproven) shipped state instead of leaving proof-supporting data in place. The proof happened; the fix didn't ship.

**How to apply:** round 5 instructions (final item only) written to `C:/dev/cic-ingestion/CODEX_FIX_INSTRUCTIONS.md` — explicitly require the 2+-session non-conflicting seed to remain in the committed file, not just demonstrated then reverted. If this recurs a 4th time, treat as a genuine blocker requiring a different approach (e.g. write the fix directly rather than re-delegating).

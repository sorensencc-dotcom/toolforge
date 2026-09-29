---
name: session-wrap-2026-09-24-cic-jev-injection-fixed-closed
description: "cic-jev prompt-injection fixed at code level, calibration split by question type, both + determinism gap written into spec doc — all 3 next-steps from the 09-23 wrap closed, nothing open"
metadata:
  node_type: memory
  type: project
  modified: 2026-09-24T15:15:24.309Z
  originSessionId: 620c47a2-8790-4e98-9fcd-ccd3f1ac7f27
---

Repo: `C:\dev\cic-jev`. Closes out [[session-wrap-2026-09-23-cic-jev-confidence-eval-hardened]] — all 3 deferred next-steps done, pushed `origin/main` at `8dd66c4`.

## What shipped
1. **`40246af`** — `sanitizeState()` in `src/schema.js`: code-level defense against prompt injection. Fencing alone (confirmed insufficient in the 09-23 session) is kept as defense in depth, but the real fix strips imperative-override phrasing (system override, ignore instructions, dictated answer/certainty) out of every string in `state` before it reaches the prompt. Verified against the real model (qwen2.5:7b) twice: `Critical cases: 1/1 passed` both runs, previously reproducibly 0/1. 48/48 unit tests green, 5 new.
2. **`b56a132`** — `eval-confidence.mjs` now prints calibration correlation broken down by question type, not just pooled. Root cause of the earlier -0.17 pooled correlation: both wrong answers were `choice`-type (diff-severity classification) carrying the *highest* confidence in the set — overconfidence concentrated in one type, not uniform miscalibration. Diagnostic only, pooled figure stays the pass/fail gate (per-type n too small to gate on its own).
3. **`8dd66c4`** — wrote all 3 findings (injection fix, cross-process ROCm determinism gap, calibration-by-type) into `docs/meta/spec-local-jev-engine.md` §2 item 3, under a new "Known limitations" block.

## Note for future sessions
- `JEV_MODEL=llama3.1:8b`/`llama3.3` swap-test against the injection case (the original planned next-step) turned out unnecessary — the code-level fix resolved it regardless of which local model runs, since the defense is in the prompt-building layer, not model-specific behavior tuning.
- `sanitizeState`'s pattern list is not exhaustive — documented as raising the bar, not proof of resistance. If a new injection phrasing gets past it, extend the `INJECTION_PATTERNS` array in `src/schema.js`.
- Cross-process determinism gap (ROCm GPU, same seed/temp pin, still drifts across process boundaries) remains unfixed — documented as a known limitation, not chased further per prior session's call.

Nothing open on cic-jev.

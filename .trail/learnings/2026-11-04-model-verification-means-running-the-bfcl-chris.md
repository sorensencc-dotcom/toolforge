---
title: Model verification means running the BFCL evaluator over every installed model and taking its winner
author: Chris
date: 2026-11-04
branch: fix/pin-qwen25-7b
cost: { minutes: 1, tokens: 1263 }
id: l-71a00019
scope: repo
status: active
src: agent
touches:
  - "_integration/model_selection.json"
  - src/providers/model-selection.test.js
---

## Decided
"WhichLLM model verifier" means the BFCL tool-calling evaluator, not the governance validation suite. Run it live against all installed models and let it pick the best for this machine. Do not pre-limit it to models you chose.

In the code:
- Evaluator: `npm run eval:whichllm -- --live-inference` in the trm repo (src/whichllm/evaluator.ts).
- Pinned model lives in `_integration/model_selection.json` (`validated_local_model.model`) and is asserted by `src/providers/model-selection.test.js`.
- Live run, 3 samples per scenario: qwen2.5:7b 0.75, llama3.1:8b 0.667 (0% relevance rejection), qwen2.5:1.5b 0.333.

## Tried and ruled out
- CIC-GOVERNANCE `validation/whichllm` scripts: they check lineage, hash chain and GGUF provenance, not model accuracy.
- Restricting the run to two hand-picked models.

## Watch out
- Without `--output` the evaluator overwrites `_integration/model_selection.json` and drops the hand-added routing fields (provider, routing_state, cloud_routing_enabled, echo_mismatch_policy). Write to a temp path and copy only the model.
- A scheme-less machine `OLLAMA_HOST` (127.0.0.1:11434) fails with "Failed to parse URL"; set `http://127.0.0.1:11434` for the run.

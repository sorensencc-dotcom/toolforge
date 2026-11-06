---
title: Regenerating the model selection record must keep the local-only routing fields
author: Chris
date: 2026-11-03
branch: fix/restore-model-selection-record
cost: { minutes: 6, tokens: 43914 }
id: l-a0751002
scope: repo
status: active
src: agent
touches:
  - "_integration/model_selection.json"
  - src/providers/model-selection.js
  - src/providers/model-selection.test.js
---

## Decided
Governance matrix for toolforge went red because the WhichLLM hardware-eval commit regenerated the routing record and dropped the hand-added local-only routing fields. Fix restores those fields verbatim from the last good version and leaves the generated eval data alone.

## Tried and ruled out
- The `npm ci` error in the matrix log is not the cause; the workflow falls back to `npm install`.
- Reading the parent of the breaking commit for the old fields: the parent lacks them, because the diff was relative to a different blob. Take them from the #118 commit instead.

## Watch out
- WhichLLM regeneration overwrites the whole record, so the next run will drop the routing fields again unless the generator preserves them.
- Record now pins llama3.1:8b (test asserts it) while recommendations says qwen2.5:1.5b; switching needs a test change and fresh validation.
- The Retro Full History Audit is a separate failure: it needs a retro under 7 days old on main.

In the code:
- _integration/model_selection.json (restored: provider, validated_local_model, routing_state, cloud_routing_enabled, policy_version, steward, echo_mismatch_policy)
- src/providers/model-selection.js loadModelSelection, src/providers/model-selection.test.js
- breaking commit 56d7f976, last good b23bce75

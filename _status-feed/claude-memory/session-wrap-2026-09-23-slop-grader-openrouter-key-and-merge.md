---
name: session-wrap-2026-09-23-slop-grader-openrouter-key-and-merge
description: "Merged parkd821-20260908 into toolforge main, then found and fixed slop-grader-sweep defaulting to a paid OpenRouter model on a real pasted key."
metadata: 
  node_type: memory
  type: project
  originSessionId: c163ec6a-e920-4cdc-b811-ab966b3ef731
  modified: 2026-09-23T17:44:42.111Z
---

`parkd821-20260908` merged into `main` in worktree
`C:/dev/dev-sandbox/toolforge-herdr-trm-integration` — commit `01ecee04`,
pushed to `origin/main` (toolforge repo). 230/231 tests green (1 skip,
external fixture). Conflict resolution notes not repeated here — see git log.

**Real finding, not hypothetical:** ran the `slop-grader-sweep` skill's
manual Step 7 smoke test with a real `OPENROUTER_API_KEY` (user pasted the
key directly in chat — treat as compromised, must rotate at
openrouter.ai). Discovered `@lukstei/slop-grader`'s own default model
(`typesafe/jev-1.13`, hit via `https://openrouter.ai/api/alpha/decisions`)
is a **paid** model with no `:free` suffix — the wrapper had no `--model`
flag at all, so every graded file spent real credit silently. A first
run (accidentally invoked from inside the skill dir, wrong cwd) wrote the
report to the wrong path (`skills/slop-grader-sweep/drift/`, not repo-root
`drift/`) — doc's own instructions were actually correct on re-check, my
invocation was wrong. A second, correct invocation then swept the full
repo (651 files) against the paid model before this was caught.

**Fix shipped, commit `9a900622` on `main`:** pinned
`DEFAULT_MODEL = 'google/gemma-4-31b-it:free'` in
`skills/slop-grader-sweep/src/slop-grader-runner.ts`, overridable via
`SLOP_GRADER_MODEL` env var, wired through `buildGraderArgs` as
`--provider openrouter --model <model>`. Verified against a live
`GET https://openrouter.ai/api/v1/models` call (20 free models available
at check time — catalog changes, re-verify before trusting this id later).
49/49 tests green after the fix (had to update one argv-shape test
assertion). README.md + docs/USAGE.md updated to document the pin.

**Key rotation closed 2026-09-23 (later same-day session):** user revoked
old key on openrouter.ai and put new key in `C:/dev/.env`
(`OPENROUTER_API_KEY`). New key set as GitHub Actions repo secret on
`sorensencc-dotcom/toolforge` via `gh secret set` (confirmed present via
`gh secret list`, updated 2026-09-23T17:43:57Z).

**Still open, human-only:**
1. ~~Rotate key~~ — DONE.
2. ~~Set new key locally + gh secret~~ — DONE.
3. `parkd821-20260908` branch not deleted — blocked because the user's
   primary checkout at `C:/dev` is dirty (~19 modified files, daemon
   churn) and 5 commits ahead of `origin/parkd821-20260908`. Fully merged
   into main already, so deletion is cosmetic cleanup only, not urgent.

See [[feedback_verify_ai_design_doc_premises]] for the general pattern
this confirms: a tool's own defaults are not verified safe just because
it has an env-var-gated credential — check what model/endpoint it
actually calls before running it against a real paid key.

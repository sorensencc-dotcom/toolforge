---
name: session-wrap-2026-09-23-slop-grader-and-heuristics-fix
description: "OpenRouter key rotated + set as gh secret; slop-grader-sweep found architecturally unable to use a free/local model; writing-heuristics heading-sentence-case autofix disabled (was corrupting proper nouns). Next: clear active-voice + serial-comma backlog in kb-sync."
metadata:
  node_type: memory
  type: project
  originSessionId: c163ec6a-e920-4cdc-b811-ab966b3ef731
  modified: 2026-09-23T21:21:51.273Z
---

**Key rotation (closed):** old OpenRouter key (pasted in chat 2026-09-22) revoked
by user, new key in `C:/dev/.env` (`OPENROUTER_API_KEY`), set as GitHub Actions
repo secret on `sorensencc-dotcom/toolforge` via `gh secret set` (confirmed
`gh secret list`, updated 2026-09-23T17:43:57Z). Nothing open here.

**slop-grader-sweep — architecturally blocked, not just a config issue.**
`@lukstei/slop-grader` (`skills/slop-grader-sweep`'s dependency) only supports
two providers: `jev` (typesafe.ai, paid) and `openrouter` — and the openrouter
path isn't a normal chat-completions call, it POSTs to
`https://openrouter.ai/api/alpha/decisions`, Jev's own typed-probability
protocol. `--model` overrides which *Jev model version*, not an arbitrary
OpenRouter/local model. The earlier "pin to a free OpenRouter model" fix
(commit `9a900622`) rests on a false premise — confirmed live: pointing at
`google/gemma-4-31b-it:free` 400'd with "Model google/gemma-4-31b-it does not
exist" (the alpha/decisions endpoint dropped the `:free` suffix and doesn't
recognize the bare id). No free tier exists for this tool via OpenRouter.
Ollama is installed locally (`llama3.1:8b`, `qwen2.5:7b`) but Ollama's
OpenAI-compatible surface doesn't implement Jev's typed-probability protocol
either — using it would mean forking a third provider into
`slop-grader-runner.ts` and writing a local grading loop from scratch, with
lower quality (no calibrated typed probabilities) than Jev's approach.
Options left on the table, undecided: (a) fund the OpenRouter account and
accept per-file cost on `typesafe/jev-1.13`, (b) check TypeSafe AI's own
pricing/free-tier via `TYPESAFE_API_KEY`, untested, (c) build a local-model
provider fork, real work, lower fidelity, (d) park `slop-grader-sweep`
indefinitely and rely on `skills/writing-heuristics/` only.

**writing-heuristics bug found + fixed, commit `928c6064`.**
Verified 2026-09-23: this landed on branch `parkd821-20260908` in `C:/dev`
(the branch checked out there this session), NOT `main` — `git log -1 main`
shows `main`'s HEAD unrelated (last touch to this file `9a900622`, and
`origin/main` has since moved to `d7e07d9b`, a release commit, past that).
`parkd821-20260908` is 1 commit ahead of `origin/parkd821-20260908` —
**unpushed**. Push or PR this before/at start of next session, and decide
whether it should go to `main` directly or through this branch's normal
merge path (same branch as the 2026-09-22/23 slop-grader-sweep work,
already-merged-to-main once before per that lineage — check whether this
branch is meant to be reused or is stale scaffolding at this point).
`heading-sentence-case`'s autofix (`toSentenceCase()` in
`skills/writing-heuristics/src/fixer.ts`) had no proper-noun detection —
lowercased every word except the first, ALL-CAPS tokens, and code spans.
Confirmed live against `C:/dev/kb-sync`: it turned "Gemini Notebook (formerly
Google NotebookLM)" into "Gemini notebook (formerly google notebooklm)" and
"Google Drive Source" into "Google drive source" in
`notebooklm-mcp-cli/docs/API_REFERENCE.md` (reverted, no diff left). kb-sync's
wiki carries an unbounded proper-noun surface (place/company/person names
across its research corpus — mining concessions, historical figures), so no
deterministic dictionary can safely disambiguate. Fix: flipped
`autofix: false` for this rule in both `heuristics.json` and the violation
push site (`src/linter.ts`), removed the now-dead fixer branch, updated 2
test assertions in `tests/fixer.test.ts` that relied on the old unsafe
behavior, regenerated `SKILL.md`/`docs/rules.md` via `npm run compile`,
fixed a false autofix claim in `README.md`. 48/48 tests green. Rule still
fires as a hard error in `check` mode — resolution is now manual-only.

**Reports on disk (kb-sync), from the full sweep:**
- `C:/dev/kb-sync/drift/HEURISTICS-REPORT.json` — full `writing-heuristics
  check` run against `docs/`, `wiki/`, `modules/wiki/`,
  `notebooklm-mcp-cli/docs/`. 2053 files scanned, 9819 errors, 60 warnings.
  Breakdown: `heading-sentence-case` 9819 (now confirmed unsafe-to-autofix,
  parked for manual review — NOT today's task), `active-voice` 41,
  `serial-comma` 11, `ban-filler-adverbs` 6, `condition-before-action` 1,
  `avoid-first-person-plural` 1.
- `C:/dev/kb-sync/drift/SLOP-REPORT.md` — DEGRADED, slop-grader-sweep blocked
  per above, not relevant to the next task.

**Next task, this handoff's actual ask:** clear the `active-voice` (41) and
`serial-comma` (11) backlog in kb-sync — the two next-largest rule violation
groups from `HEURISTICS-REPORT.json`, both far smaller than
`heading-sentence-case` and, per `heuristics.json`, NOT marked `autofix: true`
either (check before assuming — verify current flags; `serial-comma`'s
regex-based fixer risk profile needs the same proper-noun-style sanity check
`heading-sentence-case` just failed before trusting any bulk fix). Likely
manual-fix-per-finding work, not a script run. Start by re-reading
`C:/dev/kb-sync/drift/HEURISTICS-REPORT.json`'s `active-voice` and
`serial-comma` entries (filter `violations[].ruleId`), fix each finding by
hand in the source `.md` file, rerun `check` scoped to the touched files to
confirm clean, commit per the repo's existing commit-tag conventions (this
is doc-only content, not `skills/writing-heuristics/` code — different
repo/dir, kb-sync — confirm kb-sync's own commit conventions, don't assume
toolforge's apply).

See [[feedback_verify_ai_design_doc_premises]] — same pattern twice in one
session: a tool's own defaults/docs aren't verified safe or accurate until
checked against a real live call.

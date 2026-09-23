---
name: session-wrap-2026-09-02-claude-api-prompt-audit
description: Ran /claude-api prompt-audit on c:\Dev; surface clean except stale Claude model pins; fixed + committed a73d3d78
metadata: 
  node_type: memory
  type: project
  originSessionId: b33a28c8-bf92-4447-87b3-a388c4b35fa2
  modified: 2026-09-02T19:11:34.244Z
---

**Session 2026-09-02 (~4.5h).** Ran `/claude-api prompt-audit` over `c:\Dev`.

**Scope:** authored prompt surface = root `CLAUDE.md` + `AGENTS.md` + 50
`skills/*/SKILL.md`. Excluded `node_modules`, `graft/` cards, `research-data/`,
`.ijfw/` metrics, bundled skills, and `CIC-GOVERNANCE` / `viking-phase3`
(non-Anthropic — `whichllm` = OpenRouter/OpenAI). Target model: `claude-opus-5`.

**Result: the authored prompt surface is clean.** Zero hits for dated scaffolds
across all 50 SKILL.md files — no "think step by step", no `<scratchpad>`, no
assistant prefill, no `budget_tokens`/`temperature` in request code, no
narration-suppressors, no numeric word caps, no `STEP 1/2` choreography.
Pressure-word density near zero. Nothing to tune down.

**Only real finding — stale/mismatched Claude model pins:**
- `skills/work-summarizer/`: code default `claude-3-5-sonnet-20240620` (retired)
  in `src/providers/{claudeProvider,index}.ts` + `PROVIDERS.md`; docs said
  `claude-haiku-4-5-20251001` (date-suffixed) in `SKILL.md`, `skill.json`,
  `docs/USAGE.md` — code and docs already disagreed. Reconciled all to
  `claude-haiku-4-5`. `dist/` rebuilt (`npm run build`, gitignored).
- `scripts/run-closed-loop-research-v2.{mjs,py}`: `frontier_judgment_anchor`
  default `claude-3-5-sonnet-20241022` (retired judge anchor) -> `claude-opus-5`.

**Left as-is (in report, not actioned):** `whichllm-bfcl-evaluator.*` model-
under-test lists + `_integration/model_selection.json` + the whichllm wiki doc
(benchmark data / generated artifacts); `AGENTS.md` 4x duplicate IJFW
frontmatter (tool-managed region); `CLAUDE.md` date/history archaeology
(low-confidence, likely intentional governance context).

**Committed `a73d3d78`** — 8 files, 13 insertions / 13 deletions. NOT pushed.
Landed on branch `spec/sigil-inter-relay-routing`, not a dedicated branch: a
background IJFW hook reset the `chore/stale-model-pins` branch I created,
switched HEAD back to the spec branch, and committed its own
`docs(sigil): mark I1 resolved` (`68adb185`) mid-sequence — my commit stacked on
top. Deleted the empty `chore/` branch. Move `a73d3d78` to its own branch off
`main` if clean separation wanted (cherry-pick + reset; do it when the
background agent is quiet).

**Gotcha:** the Edit tool normalized CRLF->LF on whole-file write, producing
817-line whitespace churn. Reverted, redid via `sed -i`. See
[[feedback-edit-tool-crlf-normalization]].

**Next:** nothing outstanding on the audit. Unrelated open threads carried from
prior sessions (sigil federation I1, parallel-search) untouched this session.

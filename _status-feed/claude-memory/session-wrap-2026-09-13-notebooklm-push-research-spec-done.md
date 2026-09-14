---
name: session-wrap-2026-09-13-notebooklm-push-research-spec-done
description: "NotebookLM push-research loop design spec approved+committed; writing-plans not started, fresh session picks up plan-writing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4538b0b9-26f8-4da9-9d79-4983c8c987c6
  modified: 2026-09-13T23:59:36.036Z
---

Spec for NotebookLM push-research loop DONE and committed: `C:\dev\trm\docs\superpowers\specs\2026-09-13-notebooklm-push-research-loop-design.md`, commit `4b99fc9` on `trm` repo `main`. User approved ("agreee"), fixed codex-reviewed gaps (3-step dispatch sequence since `--cited-only` only exists on `research import` not `start`; TODOS.md idempotency key threading via `gap_key`; concrete stall-check mechanism; deterministic notebook-ordering; concurrency/GC as accepted non-goals).

**Why paused:** session hit ~3.1h active work; user chose fresh session over continuing into plan-writing (a big multi-task write).

**Next step:** invoke `superpowers:writing-plans` on that spec in a fresh session. Context already gathered (don't re-read unless stale):
- `src/notebooklm/registry.ts` — has `mutateNotebook` pattern; new `ResearchQueueEntry`/`research_queue` field + `upsertResearchQueueEntry` go here.
- `src/notebooklm/nlmCli.ts` — existing `runNlm()` wrapper assumes `--json`; `research start/status/import` have **no `--json` flag** (confirmed live via `--help`, 2026-09-13). Investigated free alternatives (found `notebooklm-mcp` pip pkg at `C:\Users\soren\AppData\Roaming\Python\Python314\site-packages\notebooklm_mcp` — dead end, unrelated tool, no `research` command, ships `notebooklm-mcp`/`notebooklm-server` entry points only, not `nlm`). No throwaway NotebookLM notebook exists to safely live-probe (`nlm notebook list` showed only real personal/work notebooks: CIC-KB, Personal OS, CIC - Daily Research, Architectural Design Patterns, Tampa Bourbon Hunting, Tesla, AI News and Tools, AI-Ideas — none disposable). **Decision: defer parser-format resolution to execution time** — the plan's dispatch-wrapper task should include a real code skeleton for `research start`/`status`/`import` wrappers based on confirmed `--help` contracts, plus an explicit step telling the implementer to run it live once against a real notebook and adjust the stdout-parsing regex — not a vague TODO, an honest "verify against live output" step.
- `import` auto-detects task_id if omitted ("If TASK_ID is not provided, automatically imports from the first available completed or in-progress research task") — may reduce/eliminate need to parse task_id out of `start`'s stdout.
- `src/core/config.ts`/`types.ts` — `TrmConfig`/`loadConfig` pattern confirmed, need `dispatch_limits` block added.
- `src/cli/index.ts` — commander wiring pattern confirmed (mirror `mine-notebooklm` command registration).
- `src/cli/commands/mineNotebooklm.ts` — exact line refs already cited in spec (`:184`, `:186`, `:200`) for where `upsertResearchQueueEntry` sibling call goes.
- Test runner is **jest** (`jest.mock`, tmpdir registry fixture via `fs.mkdtempSync` + `registryPath()` seed) — confirmed via `mineNotebooklm.test.ts`/`registry.test.ts`, mirror these conventions in the new plan's test tasks.
- Nightly wrapper: `C:\dev\trm\schedule-task-wrapper-TRM-Notebooklm-Mine.ps1` — needs a second `research-notebooklm` stage appended after the existing mining loop.

See [[project-notebooklm-ingest-live-bugs-2026-08-13]] for prior related NotebookLM ingest work in this repo.

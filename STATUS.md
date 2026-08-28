# Project status

## Current goal
Maintain the cross-repository governance CI matrix and onboard repositories in waves.

## Completed work
- Added the CI governance matrix for the initial repositories.
- Added Wave 2 entries for `toolforge` and `sigil-repo`.
- Added Wave 3 entries for `cic-vision-governance`, `charlie-deep-research`, `financeos`, and `TheFoundry`.
- Pushed commits `09657c0d` and `ae0ddc1` to `feat/openrouter-oxalpha-integration`.

## Decisions
- `AGENTS.md` is the canonical shared instruction surface.
- `CLAUDE.md` imports `AGENTS.md` instead of duplicating project rules.
- Wave 3 repositories use the standard `gov:validate` and `gov:smoke` contract until their manifests expose verified commands.

## Tests
- Initial governance matrix commands passed for the four established repositories.
- Matrix structure verified with 10 repository entries, 10 validation commands, and 10 smoke commands.
- Wave 3 commands were not executable locally because several checkouts lack package manifests or governance scripts.

## Blockers
- Wave 3 repository command entry points remain unverified in local checkouts.

## Next action
Confirm Wave 3 repository manifests and replace placeholder governance commands with executable adapters.

## Cross-repository path-drift containment (2026-08-28)

### Completed work
- Added `C:\dev\scripts\verify-repo-context.ps1`, a fail-closed preflight requiring an absolute Git repository root, attached branch, and root `package.json`.
- Added the mandatory invocation and ambiguity rule to `AGENTS.md`.
- Verified six canonical repositories: `cic-ingestion`, `kb-sync`, `rewrite-docs`, `rewrite-mcp`, `sigil-repo`, and `trm`.
- Verified relative paths and nested repository paths fail closed.

### Findings
- Twelve top-level Git checkouts are present under `C:\dev`.
- Eleven lack a local `STATUS.md`; all inspected top-level repositories lack a local `AGENTS.md`.
- Several checkouts are dirty, so bulk synchronization remains unsafe without repository-by-repository review.

### Blockers
- Cross-CLI adoption and per-repository instruction rollout remain incomplete.
- Existing dirty worktrees require explicit preservation checks before any automated repair.

### Next action
Audit each CLI entry point for preflight enforcement, then propose a staged adoption plan for the remaining repositories.

## KB-Sync dashboard verification (2026-08-28)

### Completed work
- Confirmed dependency verification and adversarial drift tests pass.
- Identified the dashboard data-path defect: the server was rooted at `modules/wiki`, while `.validation-report.json` is generated at the repository root.
- Updated `kb-sync/package.json` so `wiki:dashboard:serve` serves the repository root and opens `modules/wiki/dashboard.html`.

### Blockers
- The currently running dashboard server must be restarted with the updated command before BrowserOS neo can verify live report loading.

### Next action
Restart with `npm run wiki:dashboard:serve`, then verify the dashboard in BrowserOS neo at `http://127.0.0.1:8080/modules/wiki/dashboard.html`.

## TRM DevOps NotebookLM Sync & Triage Pipeline (2026-08-28)

### Completed work
- Designed, simulated, and implemented the full TRM DevOps pipeline in `modules/trm-devops/`.
- Built error normalizer and SHA-256 signature generator with cross-platform invariance and semantic timestamp preservation (`src/core/normalizer.ts`).
- Built concurrency file lock with exponential backoff and stale-lock recovery (`src/core/lock.ts`).
- Built zero-hallucination chunk schema validator with dead-letter quarantine (`src/core/extractor.ts`).
- Built offline fallback buffer and NotebookLM adapter bridge (`src/core/notebooklm-client.ts`).
- Built Markdown queue reconciler with structured operator notes preservation, 10x idempotency, and atomic rename writes (`src/core/reconciler.ts`).
- Built monthly archival engine with duration metric fallbacks and global `index.json` management (`src/core/pruning.ts`).
- Built CLI entrypoint (`src/cli/index.ts`) supporting `sync`, `prune`, and `status`.
- Built MCP Server adapter (`src/mcp/server.ts`) exposing tools `sync_dev_triage`, `prune_triage_source`, and `query_dev_notebook`.
- Verified 60/60 unit and integration tests passing cleanly.

### Decisions
- Hybrid architecture: Shared core engine wrapped by both CLI script and MCP server.
- Fail-closed atomicity: File mutations use temporary staging and atomic renames under `queue.md.lock`.
- Offline resilience: Transient API outages stage payloads into `dev/triage/.cache/pending-sync/` for subsequent automated draining.

### Next action
Proceed with local branch integration or deployment.


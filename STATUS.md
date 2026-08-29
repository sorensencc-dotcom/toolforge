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

### Verification result
- Corrected `modules/wiki/dashboard.html` to fetch `../../.validation-report.json`.
- BrowserOS neo loaded live report data: 2,357 files, 0 errors, and 2,630 warnings.
- Dashboard and report endpoints both returned HTTP 200.

## Dashboard process persistence (2026-08-28)

### Completed work
- Added `scripts/ensure-dashboard-server.ps1` to health-check, repair, and verify the localhost dashboard server.
- Added `scripts/register-dashboard-server-task.ps1` for idempotent startup/logon registration with restart-on-failure settings.
- Added `wiki:dashboard:watchdog` and `wiki:dashboard:install-task` npm commands.
- Watchdog execution, PowerShell parsing, and registration-script list mode passed.

### Next action
Run `npm run wiki:dashboard:install-task` once to register the Windows task.

## Cross-audit integration (2026-08-28)

### Completed work
- Added `scripts/cross-audit.mjs` as the executable kb-sync bridge to the shared adversarial auditor.
- Added strict packet validation, verdict validation, non-consensus exit code `2`, and malformed-input exit code `1`.
- Added focused adapter tests covering successful invocation and rejected packets.
- Added `cross-audit` and `test:cross-audit` npm commands.

### Verification
- Repository preflight passed for `C:\dev\kb-sync`.
- Cross-audit adapter tests passed: 2/2.
- Node syntax check passed.

### Next action
Run `npm run cross-audit -- <packet.json>` with a real audit packet when an Iron Gate failure needs independent review.

## Wiki sibling documentation (2026-08-28)

### Completed work
- Added sibling nodes for `modules/wiki/dashboard.html`, `scripts/verify-dependencies.mjs`, and `scripts/verify-dependencies.test.mjs` under `kb-sync/wiki/entities/`.
- Documented dashboard data-path and serving behavior, dependency verification usage, and dependency-test coverage.

### Verification result
- All 60 unit and integration tests passed in `node:test`.
- Repo context preflight passed.
- Rendered standalone Cathryn Lavery warm-palette diagram (`trm-devops-triage-architecture.html` and `.png`).
- Published dedicated wiki page `trm-devops-triage-pipeline.md` and sidebar navigation to GitHub Wiki.
- Only the three requested wiki nodes are intended for staging.

### Dirty worktree review
- Existing generated and unrelated changes remain deferred: validation/sync reports, Obsidian mirrors, research RFCs, temporary publish files, `TODOS.md`, governance config, and dashboard task scripts.
- No unrelated files were edited or staged.

## TRM DevOps NotebookLM Sync & Triage Pipeline (2026-08-28)

### Completed work
- Added `@toolforge/trm-devops` module in `modules/trm-devops/` with normalization, validation, locking, reconciler, and pruning.
- Created `trm-devops-triage` skill in `skills/trm-devops-triage/` (with `SKILL.md`, `README.md`, `docs/USAGE.md`) and `.agents/skills/trm-devops-triage/`.
- Validated with 60 / 60 passing tests across 9 test suites in `modules/trm-devops`.
- Completed `/plan-eng-review` architectural, code quality, test coverage, and failure mode analysis.
- Built error normalizer and SHA-256 signature generator with cross-platform invariance and semantic timestamp preservation (`src/core/normalizer.ts`).
- Built concurrency file lock with exponential backoff and stale-lock recovery (`src/core/lock.ts`).
- Built zero-hallucination chunk schema validator with dead-letter quarantine (`src/core/extractor.ts`).
- Built offline fallback buffer and NotebookLM adapter bridge (`src/core/notebooklm-client.ts`).
- Built Markdown queue reconciler with structured operator notes preservation, 10x idempotency, and atomic rename writes (`src/core/reconciler.ts`).
- Built monthly archival engine with duration metric fallbacks and global `index.json` management (`src/core/pruning.ts`).
- Built CLI entrypoint (`src/cli/index.ts`) supporting `sync`, `prune`, and `status`.
- Built MCP Server adapter (`src/mcp/server.ts`) exposing tools `sync_dev_triage`, `prune_triage_source`, and `query_dev_notebook`.

### Verification result
- All 60 unit and integration tests passed in `node:test`.
- Repo context preflight passed.
- Rendered standalone Cathryn Lavery warm-palette diagram (`trm-devops-triage-architecture.html` and `.png`).
- Published dedicated wiki page `trm-devops-triage-pipeline.md` and sidebar navigation to GitHub Wiki.

### Next action
Proceed with operational triage runs using `trm-devops-triage`.

## Dependency verification lock (2026-08-28)

### Completed work
- Strengthened `kb-sync/scripts/verify-dependencies.mjs` to require installed `typescript@5.4.5` and `js-tiktoken@1.0.21` package metadata in `node_modules`, in addition to exact manifest and lockfile pins.
- Added tests for missing and mismatched installed dependencies.

### Verification
- Dependency verifier tests passed: 4 / 4.
- `npm run deps:verify` passed in `C:\dev\kb-sync`.
- Existing unrelated trailing whitespace remains in wiki files; no cleanup was performed.

### Next action
Use `npm run deps:verify` before committing compiler or context-compaction changes.

## Wave 2 repair audit gate (2026-08-28)

### Completed work
- Added `kb-sync/modules/healing/repair-audit-gate.ts` as a deterministic local referee for compiler/linter collisions.
- Added bounded remediation recipes, declared-scope checks, and focused tests.
- Added `npm run test:repair-audit`.

### Verification
- Repair-audit tests passed: 3 / 3.
- Explicit TypeScript 5.4.5 type check passed.
- `npm run deps:verify` passed.

### Next action
Run `npm run test:repair-audit` after a failed local compiler or linter gate.

## Headless visual verification (2026-08-28)

### Completed work
- Added `kb-sync/skills/html-visual-verify/src/render-quality.ts` for headless Chromium rendering of HTML dashboards and Mermaid charts.
- Added screenshot pixel metrics for non-background fraction, dark fraction, and color variance.
- Added blank-screen and browser-console-error failure detection.
- Added `npm run visual:verify` and focused fixtures.
- Added project dependencies `playwright` and `pngjs`.

### Verification
- Visual verification tests passed: 2 / 2.
- Explicit TypeScript check passed.
- `npm run deps:verify` passed.

### Next action
Run `npm run visual:verify` against generated dashboards before delivery.

## Recipient-not-found relay guard (2026-08-28)

### Completed work
- Added transaction-time recipient existence checks for federated and non-federated envelopes.
- Updated PostgreSQL lookup to use the exact endpoint ID, including its federated domain.
- Added equivalent active-registry lookup to the in-memory relay repository.
- Added HTTP and acceptance-path regression tests proving unknown recipients do not persist.

### Verification
- Envelope and HTTP relay tests passed: 71 / 71.
- Repository preflight passed for `C:\dev\sigil-repo`.

### Next action
Commit and push the recipient validation guard after review.

## GBrain Local Engine Setup (2026-08-28)

### Completed work
- Compiled and linked `gbrain` v0.47.4.0 binary on PATH.
- Initialized local PGLite database engine at `~/.gbrain/brain.pglite`.
- Configured local brain settings in `~/.gbrain/config.json`.
- Registered `toolforge` source for `c:\dev` and created `.gbrain-source` pin.

### Verification
- `gbrain version`: 0.47.4.0.
- `gbrain doctor --fast --json` and `gbrain stats` executed cleanly.
- Repository preflight passed for `C:\dev`.

### Next action
Index repository sources with `gbrain sync --source toolforge`.


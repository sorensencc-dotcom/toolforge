# Memory Index

Persistent memory system for long-term context across sessions. Individual memory files under `memory/` carry their own frontmatter (see e.g. `memory/workflow-checklists-embedded.md`); this index file does not. Entry structure is intentionally per-section: `Current Work` uses dated one-line status bullets; `Learnings & Incident Post-Mortems` uses Problem / Prevention-steps (or Fix & Pattern); `Preferences & Feedback` uses Why / How-to-apply. Do not homogenize — the shapes match each section's purpose.

## System Governance & Architecture

- **3-Tier Authority Model**: Tier 1 (Decision / Strategic) | Tier 2 (Execution / Feature) | Tier 3 (Automation / CI).
- **Pre-Commit Hook Shim Architecture** (fixed 2026-08-23): both `setup-git-hooks.ps1` and `CIC-GOVERNANCE/scripts/setup-git-hook.mjs` now write the identical chained shim to `.git/hooks/pre-commit` (governance validation → secret scanning via `scripts/secret-scan-hook.sh` → retro/roadmap `pre-commit.ps1` gate). Order-independent: whichever installer runs last, the result is the same full chain — closes the earlier race where running `setup-git-hooks.ps1` last silently dropped governance/secret checks.
- **Canonical Roadmap Locations**: Roadmaps are restricted to `docs/meta/` or project roots (`cic-ingestion/`, `rewrite-docs/`, `rewrite-mcp/`, `kb-sync/`). Forbidden in nested worktrees, `.claude/`, or archive dirs.
- **Skill Compliance**: Enforced structure via Skill Operator Guide (`docs/meta/skill-operator-guide.md`). Standard files: `README.md` (<100 lines), `SKILL.md` (<150 lines), `docs/USAGE.md`.

## Current Work

- **Healing Subsystem** (2026-08-15): TripwireMonitor, AdversarialAuditor modules under `modules/healing/`.
- **NotebookLM CIC Ingestion/Mining Design** (2026-08-12): ingestion + mining design for CIC docs into NotebookLM.
- **Sigil Governed-Mailbox Protocol Spec** (2026-08-12): spec for peer-to-peer agent mailbox protocol.
- **Toolforge Marketplace Phase 8 Wave D**: still not shipped — `docs/meta/phase-8-toolforge-marketplace/SUCCESS.md` remains TEMPLATE FOR EXECUTION, unchecked, unsigned. Target date 2026-07-26 passed unmet. Treat as not started until signed.
- **Retro Schema Canonical v1.0 Lock**: Retro files locked to canonical schema structure to ensure multi-week trend stability. Note: earliest retro (`2026-07-12-1.json`) had unit-scale + active_days bugs, fixed 2026-08-16.
- **Pre-Flight Test Readiness**: ESLint configuration and dist exclusions locked to maintain clean test runs (`npm test`).
- **Multi-Agent Handoff Protocol Spec** (2026-08-16 to 2026-08-17): handoff spec for cross-agent session continuity.
- **Writing-Heuristics Skill** (2026-08-18 to 2026-08-19): Phase 1+2 complete — 48 tests, 11-rule catalog.
- **Retro-Audit Automation Restoration** (2026-08-18): automated retro-audit pipeline restored.
- **CastIronCharlie-Facebook Notebook Ingest** (2026-08-19 to 2026-08-20): notebook ingestion for CastIronCharlie-Facebook data.
- **TRM Thematic Routing** (2026-08-22): thematic routing added to TRM.
- **Local GBrain Engine Setup** (2026-08-28): `gbrain v0.47.4.0` binary linked with local PGLite database engine at `~/.gbrain/brain.pglite`.
- **TRM DevOps Sync & Triage Pipeline** (2026-08-28): `@toolforge/trm-devops` module with normalization, file locking, schema validator, Markdown queue reconciler, and `trm-devops-triage` skill (60/60 tests passing).
- **Cross-Audit Adversarial Bridge** (2026-08-28): `scripts/cross-audit.mjs` with deterministic packet/verdict validation and non-consensus exit code handling.
- **GitHub Wiki Autoheal Sweeper & Sync** (2026-08-28 to 2026-08-30): Automated autoheal sweep across 444 documentation nodes achieving 100% contract compliance (`wiki:validate-contract` PASS), with author identity reconciliation in CI.
- **Security Advisory Remediations** (2026-08-30): Remediated GHSA-5p4m-2wfm-xmqj / CVE-2026-59870 via `js-yaml@4.3.2` patch; fixed GitGuardian false-positive secret patterns in tests via dynamic header construction.
- **Toolforge Skill Health Check Remediations** (2026-08-30): Registered `trm-closed-loop-research`, `trm-devops-triage`, and `wiki-sync-recovery` in `manifest.json`; aligned versioning and initialized audit run logs across all 48 skills (100% health check pass).

### 2026-09-01 → 2026-09-05 (verified against `git log` on `main` / current branch)

- **TinyFish search skill #27** (`86eabb48`): `tinyfish-search` skill — search + Markdown extract via `@tiny-fish/sdk`; spec review folded (`76ffd4d2`, `9799ce63`); dedicated wiki docs #29 (`46ad5fe8`, `fe29dd9f`).
- **parallel-search skill** (`1f489f63`): registered in skillpack, metadata refreshed; regen no longer clobbers timestamps/EOLs (`935bdc5b`).
- **Sigil cross-federation directory (federation #4)**: design spec (`7a80dd07`), Codex + caveman review passes (`3c471bed`, `b895b31d`), implementation plan (`d6596255`). Lives in `C:\dev\sigil-repo`; docs mirrored here.
- **IronLedger Phase 1**: exit-gate approval recorded (`fdd92fd`). Repo home set to `C:\dev\IronLedger` (`b176ecb`), untracked in this monorepo.
- **IronLedger Phase 2a**: dependency-posture + exit-gate evidence (`f4e9ae25`), exit-gate approval (`7d221b09`), spec/plan backfill (`373b44ed`).
- **IronLedger Phase 2b**: review + categorization design (`6af4dfb0`), spec amended for migration-runner + audit-envelope (`009a76e6`), 15-task TDD plan (`da9007b3`), plan-eng-review findings folded (`82f602b3`), execution handoff / resume point (`3401e005`, `7016fd6c`). Execution deferred to a fresh session.
- **TRM research gaps**: GAP-02 / GAP-03 / GAP-06 resolved with archival citations (`158b1095`); canonical RFCs synthesized for gaps 07 (`ba1e1b26`), 12–16 (`183a0c65`), 17–21 (`a13a062b`); deploy-script claim linter added (`e2d8e7c8`).
- **Toolforge Herdr TRM integration #30** (`2609f81`): design (`35207ca4`) + implementation plan with schema versioning and test runbook (`0bb32074`, `38fc9f71`), merged to `main`.
- **Viking Phase 3** (`67c61efb`): dynamic reporting + integrity check added to the harness.
- **Cathryn Lavery diagram-design standard**: made mandatory in `AGENTS.md` (`00232dde`) and enforced across wiki diagram build scripts (`d3779f1e`).
- **graft repo-context graph**: active for this repo (session-start hook + `graft/INDEX.md`); `graft-audit.yml` workflow present.
- **Releases**: v2.61.1 → v2.63.0 cut over this window.
- **Trend watch (retro, directional only)**: comparing `.context/retros/2026-07-12-1.json` to `2026-08-16-1.json` — `test_ratio_pct` and `feat_pct` down sharply, `fix_pct` and `docs_pct` up. Not a clean baseline: the 07-12 retro carried unit-scale + active_days bugs (fixed 2026-08-16) and the windows differ (1-day vs 7-day). Re-check on the next clean multi-week retro before acting.

## Learnings & Incident Post-Mortems

- **Hook Installer Race / Overwrite**:
  - *Problem*: Multiple installer scripts (`setup-git-hooks.ps1` and `setup-git-hook.mjs`) wrote `.git/hooks/pre-commit` independently, causing the last-run installer to silently strip retro-schema validation and roadmap location checks. A first fix attempt claimed to merge these but only patched one script's output, reproducing the same race in reverse — caught by the 2026-08-23 weekly audit and re-fixed for real (see Governance entry above).
  - *Prevention steps*: `workflow-checklists-embedded.md` § Pre-Commit Hook Maintenance Checklist (single source — don't restate here).
- **Pre-Flight Test Unblocking & Fixture Handling**:
  - *Problem*: `npm test` pre-flight broke due to (1) ESLint scanning generated `src/ui/dist` bundles without `.eslintignore`, (2) `toolforge-pdf/ingest.test.js` hard-failing when external `cic-research-vault` fixture was absent, and (3) `analytics.test.js` asserting internal DB error message instead of public wrapped message.
  - *Prevention steps*: `workflow-checklists-embedded.md` § Pre-Flight Test Verification Checklist (single source — don't restate here).
- **Roadmap Audit Scanner Logic Bugs**:
  - *Problem*: `roadmap-consolidation-scanner.ps1` reported `canonical_count=0` across all roots and suffered double scanning because (1) `Get-ChildItem` was duplicated, (2) `ClassifyLocation` checked allowed root prefixes before forbidden patterns, and (3) canonical dictionary entries were indexed with mismatched key formats.
  - *Fix & Pattern*: Evaluate forbidden/exclusion rules before prefix matching; ensure dictionary key serialization matches lookup string format across both storage and query paths.
- **Dynamic Security Token Construction in Test Suites**:
  - *Problem*: Hardcoded static dummy API tokens in test files triggered GitGuardian secret detection.
  - *Fix & Pattern*: Construct mock authorization headers and tokens dynamically (via string concatenation or runtime buffers) in test suites to prevent static pattern analyzers from flagging test fixtures.
- **Health Warning Marker Collision in Backlog Aggregator**:
  - *Problem*: `toolforgeSkillHealthCheck.ps1` skipped updating existing `<!-- todo-group: toolforge-health-warning:<Check> -->` lines when new skills triggered the same check, leaving stale date stamps and obsolete skill lists open in `TODOS.md`.
  - *Fix & Pattern*: Ensure health check passes auto-resolve cleared warnings and manifest additions keep skill registries in sync.

## Preferences & Feedback

- **Load-Bearing Memory**: `memory/MEMORY.md` must be maintained across sessions as primary project memory (`CLAUDE.md:10`).
  - *Why*: session start loads this file for context; a stale index means every session re-derives project state from scratch and re-litigates settled decisions.
  - *How to apply*: update `## Current Work` and `## Learnings` at session end when scope changes; treat absence of a recent edit spanning active work as a defect (same failure mode as a stale CHANGELOG).
- **LOC Metrics Hygiene**: Always exclude lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) from line-of-code metric trends to prevent dependency bump distortion.
  - *Why*: a single `npm install` can add 10k+ lockfile lines, swamping authored-code signal — one 12.7k-LOC resync once ate half a week's headline metric.
  - *How to apply*: run `scripts/loc-filtered.ps1` (excludes lockfiles and `chore(sync):`-tagged commits, reports their churn on a separate line) instead of raw `git diff --shortstat` for any retro or trend number.

## Archive

- Session wrap logs: `SESSION_WRAP_20260715.md`, `SESSION_WRAP_20260716.md`.
- Audit logs: `audit/COWORK-AUTO-SYNC-REPORT.md`, `audit/COWORK-REGISTERED-SKILLS.md`.
- Historical retro records: `.context/retros/*.json` (validated under v1.0 canonical schema).


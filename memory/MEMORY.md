# Memory Index

Persistent memory system for long-term context across sessions. Individual memory files under `memory/` carry their own frontmatter (see e.g. `memory/workflow-checklists-embedded.md`); this index file does not.

## System Governance & Architecture

- **3-Tier Authority Model**: Tier 1 (Decision / Strategic) | Tier 2 (Execution / Feature) | Tier 3 (Automation / CI).
- **Pre-Commit Hook Shim Architecture** (fixed 2026-08-23): both `setup-git-hooks.ps1` and `CIC-GOVERNANCE/scripts/setup-git-hook.mjs` now write the identical chained shim to `.git/hooks/pre-commit` (governance validation → secret scanning via `scripts/secret-scan-hook.sh` → retro/roadmap `pre-commit.ps1` gate). Order-independent: whichever installer runs last, the result is the same full chain — closes the earlier race where running `setup-git-hooks.ps1` last silently dropped governance/secret checks.
- **Canonical Roadmap Locations**: Roadmaps are restricted to `docs/meta/` or project roots (`cic-ingestion/`, `rewrite-docs/`, `rewrite-mcp/`, `kb-sync/`). Forbidden in nested worktrees, `.claude/`, or archive dirs.
- **Skill Compliance**: Enforced structure via Skill Operator Guide (`docs/meta/skill-operator-guide.md`). Standard files: `README.md` (<100 lines), `SKILL.md` (<150 lines), `docs/USAGE.md`.

## Current Work

- **Session audit reconciliation (2026-09-20)**: Fast-forwarded `main` to `736f738` (`v2.66.3`); canonical retro validation passes 36/36, but no new retro exists after `2026-08-16-1.json`. The daily workflow validates and reports existing files only. Next session must capture and commit a bounded canonical retro.
- **Test-ratio remediation tracking (2026-09-20)**: The 0.07% test LOC ratio in `2026-08-16-1.json` is a commit-diff metric, not repo-wide test health. Treat it as an action signal: record test-file changes and assertion-only coverage separately in the next retro instead of inferring coverage from insertion ratio.
- **Test-ratio investigation (2026-09-20)**: `scripts/investigate-retro-test-ratio.ps1` shows the 2026-08-09..16 window had 566 test LOC insertions across 9 changed test files and 3 commits with test changes, while the repository had 44 test files. The recorded 0.07% ratio is therefore not evidence of absent testing; it reflects the retro's LOC denominator or classification and needs metric recalculation before trend use.

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
- **Toolforge Skill Health Check Remediations** (2026-08-30): Registered `trm-closed-loop-research`, `trm-devops-triage`, and `wiki-sync-recovery` in `manifest.json`; aligned versioning and initialized audit run logs. The historical "48 skills / 100% health check pass" claim is retained as a past report, not treated as current source-count evidence: current checkout has 51 manifest skill names and 52 `skills/` directories containing `SKILL.md`.

## Learnings & Incident Post-Mortems

- **Retro evidence boundary**:
  - *Problem*: The scheduled audit workflow validates and analyzes existing retros but does not create a new session retro, allowing the history to stop silently.
  - *Prevention steps*: Run the canonical retro capture at session end; record the exact bounded commit window, distinguish commit-diff test ratio from repo-wide test health, and update `STATUS.md` and this memory entry together.

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


# Memory Index

Persistent memory system for long-term context across sessions. Individual memory files under `memory/` carry their own frontmatter (see e.g. `memory/workflow-checklists-embedded.md`); this index file does not.

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


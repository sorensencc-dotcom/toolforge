# Memory Index

Persistent memory system for long-term context across sessions. See frontmatter format in individual memory files.

## System Governance & Architecture

- **3-Tier Authority Model**: Tier 1 (Decision / Strategic) | Tier 2 (Execution / Feature) | Tier 3 (Automation / CI).
- **Pre-Commit Hook Shim Architecture** (Fixed in `a6b2cd7`): `.git/hooks/pre-commit` is a single unified chained shim. It prevents competing installers (`setup-git-hooks.ps1` and `setup-git-hook.mjs`) from overwriting each other, while running retro-schema validation, roadmap-location enforcement, and secret scanning (`scripts/secret-scan-hook.sh`).
- **Canonical Roadmap Locations**: Roadmaps are restricted to `docs/meta/` or project roots (`cic-ingestion/`, `rewrite-docs/`, `rewrite-mcp/`, `kb-sync/`). Forbidden in nested worktrees, `.claude/`, or archive dirs.
- **Skill Compliance**: Enforced structure via Skill Operator Guide (`docs/meta/skill-operator-guide.md`). Standard files: `README.md` (<100 lines), `SKILL.md` (<150 lines), `docs/USAGE.md`.

## Current Work

- **Toolforge Marketplace Phase 8 Wave D**: Deliverables locked to plugin manifest schema, registry service, CLI (`list`/`install`/`submit`), and submission validator. Target: Tier 1 approval & publication flow.
- **Retro Schema Canonical v1.0 Lock**: Retro files locked to canonical schema structure to ensure multi-week trend stability.
- **Pre-Flight Test Readiness**: ESLint configuration and dist exclusions locked to maintain clean test runs (`npm test`).

## Learnings & Incident Post-Mortems

- **Hook Installer Race / Overwrite (`a6b2cd7`)**:
  - *Problem*: Multiple installer scripts (`setup-git-hooks.ps1` and `setup-git-hook.mjs`) wrote `.git/hooks/pre-commit` independently, causing the last-run installer to silently strip retro-schema validation and roadmap location checks.
  - *Fix & Pattern*: Merge into a single chained shim script that invokes all hook checks sequentially, including `secret-scan-hook.sh`.
- **Pre-Flight Test Unblocking & Fixture Handling (`50467dc`)**:
  - *Problem*: `npm test` pre-flight broke due to (1) ESLint scanning generated `src/ui/dist` bundles without `.eslintignore`, (2) `toolforge-pdf/ingest.test.js` hard-failing when external `cic-research-vault` fixture was absent, and (3) `analytics.test.js` asserting internal DB error message instead of public wrapped message.
  - *Fix & Pattern*: Always exclude build outputs (`dist/`, `build/`) in `.eslintignore`. External workspace test dependencies must check fixture existence and gracefully skip when absent rather than blocking clean checkouts.
- **Roadmap Audit Scanner Logic Bugs (`b1550e3`, `21969c9`)**:
  - *Problem*: `roadmap-consolidation-scanner.ps1` reported `canonical_count=0` across all roots and suffered double scanning because (1) `Get-ChildItem` was duplicated, (2) `ClassifyLocation` checked allowed root prefixes before forbidden patterns, and (3) canonical dictionary entries were indexed with mismatched key formats.
  - *Fix & Pattern*: Evaluate forbidden/exclusion rules before prefix matching; ensure dictionary key serialization matches lookup string format across both storage and query paths.

## Preferences & Feedback

- **Load-Bearing Memory**: `memory/MEMORY.md` must be maintained across sessions as primary project memory (`CLAUDE.md:10`).
- **LOC Metrics Hygiene**: Always exclude lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) from line-of-code metric trends to prevent dependency bump distortion.

## Archive

- Session wrap logs: `SESSION_WRAP_20260715.md`, `SESSION_WRAP_20260716.md`.
- Audit logs: `audit/COWORK-AUTO-SYNC-REPORT.md`, `audit/COWORK-REGISTERED-SKILLS.md`.
- Historical retro records: `.context/retros/*.json` (validated under v1.0 canonical schema).


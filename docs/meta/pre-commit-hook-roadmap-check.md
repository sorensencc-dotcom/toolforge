# Pre-Commit Hook: Roadmap Location Check

**Status:** Implemented and tested (2026-07-21)

**File:** `.git/hooks/pre-commit` (local, not tracked in git per git design)

**Purpose:** Prevent commits of ROADMAP.md files outside allowed locations per governance policy.

## Implementation

Added `check_roadmap_locations()` bash function to `.git/hooks/pre-commit` that:

- Scans staged files using `git diff --cached --name-only`
- Case-insensitively matches ROADMAP.md or roadmap.md patterns
- Enforces allowed root locations:
  - docs/meta/
  - cic-ingestion/
  - rewrite-docs/
  - rewrite-mcp/
  - kb-sync/
- Blocks commits with violations, shows clear error message
- Includes governance reference to documentation-policy.md

## Test Results

All four test cases passed:

1. ✅ Valid commit (non-ROADMAP.md file) - commit succeeded
2. ✅ Violation (ROADMAP.md outside allowed location) - commit rejected with clear error
3. ✅ Allowed location (ROADMAP.md in docs/meta/) - commit succeeded
4. ✅ Performance (50+ files with violation) - hook completed in ~1.2s (acceptable)

## Governance

- Spec: docs/meta/roadmap-consolidation-design.md (Section 2: Pre-Commit Hook)
- Policy: docs/meta/governance/documentation-policy.md
- Phase: Phase 3.1 - Deploy Pre-Commit Hook

## Note

The hook file `.git/hooks/pre-commit` cannot be committed to git because git treats `.git/` as a protected directory for local metadata. This is a git invariant. The hook is fully functional and working correctly. If the hook is regenerated via `utilities/setup-git-hooks.ps1`, this implementation should be ported back to the generator or the hook should be manually updated.

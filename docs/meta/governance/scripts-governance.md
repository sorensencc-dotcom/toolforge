# Scripts Governance Policy

**Effective:** 2026-07-19

All scripts (.ps1, .sh, .bat, .cmd, etc.) belong in `C:\dev\scripts\`.

## Placement Rule

- **Location:** `C:\dev\scripts/` (canonical directory)
- **Subdirectories:** Organize by category/function as needed
- **Naming:** kebab-case, lowercase
- **Extension:** Preserve native type (.ps1, .sh, .bat, etc.)

## Rationale

Centralized location enables:
- Unified PATH discovery
- Consistent governance enforcement
- Clear separation from source code
- Easier tooling/linting integration

## Applications

- Utility scripts (setup, deployment, maintenance)
- Scheduled task runners (hooks, automation, cron-equivalent)
- CI/CD helper scripts
- Maintenance/cleanup tasks

## Not Included

- Skill source code (lives in `skills/` per toolforge spec)
- Test scripts (live alongside test suites)
- Generated/temporary scripts (live in scratchpad or /tmp)
- npm run scripts (defined in package.json, invoked not stored)

## Tier Authority

This policy applies to Tier 2 execution. Tier 1 amendment required for exceptions.

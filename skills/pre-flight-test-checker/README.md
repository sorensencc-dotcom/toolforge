# Pre-Flight Test Checker

Validate test environment assumptions before `npm test` runs. Detects ESLint config gaps, missing external fixtures, and platform-specific test issues.

## Quick Start

```bash
/skill pre-flight-test-checker
```

## What It Checks

- **ESLint Configuration**: Verifies `.eslintignore` includes all generated/build output directories (`dist/`, `build/`, `node_modules/`)
- **External Fixtures**: Checks for external workspace dependencies (e.g., `cic-research-vault`) and gracefully skips tests if missing
- **Platform Compliance**: Validates test assumptions for Windows vs Unix paths and assertion messages
- **Test Assertions**: Verifies test files don't assert internal error messages (use public wrapped messages instead)

## Workflow

Run before `npm test` to catch configuration issues early and prevent test pre-flight failures:

```bash
npm run test:preflight  # or
/skill pre-flight-test-checker
```

Output: RED (blockers) | YELLOW (warnings) | GREEN (ready to test)

## Reference

See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for full details.  
For troubleshooting and examples: [docs/USAGE.md](docs/USAGE.md).

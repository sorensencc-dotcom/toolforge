# Hook Validator

Audit pre-commit hook chain for completeness, order-independence, and correct sequencing. Prevents hook installer race conditions from silently breaking governance checks.

## Quick Start

```bash
/skill hook-validator
```

## What It Checks

- **Shim Completeness**: Verifies all expected hooks are present in `.git/hooks/pre-commit` (governance, secret scanning, retro schema, roadmap checks)
- **Order-Independence**: Confirms any hook installer run produces identical result (no installer overwrites another's work)
- **Sequencing**: Validates hooks execute in correct order (secret scanning → governance → retro → roadmap)
- **Installer Reconciliation**: Checks both `setup-git-hooks.ps1` and `setup-git-hook.mjs` emit the same merged shim

## Workflow

Run after git hook setup or when installer scripts change:

```bash
/skill hook-validator
```

Output: RED (broken chain) | YELLOW (partial) | GREEN (healthy)

## Reference

See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for full details.  
For troubleshooting: [docs/USAGE.md](docs/USAGE.md).

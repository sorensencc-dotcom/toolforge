# Hook Validator — Usage Guide

## Examples

### Basic Run

```bash
/skill hook-validator
# Output:
# ✓ Shim Completeness: All 4 hooks present
# ✓ Order-Independence: Both installers produce identical shim
# ✓ Sequencing: Hooks execute in correct order
# GREEN — Hook chain is healthy
```

### Verbose Output

```bash
/skill hook-validator --verbose
# Shows full hook file contents, installer reconciliation details
```

### Strict Mode

```bash
/skill hook-validator --strict
# Exit code 2 on any issue (even warnings)
```

## Common Issues & Fixes

**Shim Completeness Red Flag:**
```
❌ Shim Completeness: Missing hooks in chain: secret-scan, retro-schema-check
```
**Fix:** Re-run hook installer:
```bash
npm run setup:hooks  # or
./scripts/setup-git-hooks.ps1
```

**Order-Independence Broken:**
```
❌ Order-Independence: setup-git-hooks.ps1 produces different shim than setup-git-hook.mjs
Last-run installer stripped: governance-check, roadmap-validator
```
**Fix:** Both installers must write identical merged shim. See `MEMORY.md` incident (2026-08-23) for root cause and fix pattern.

**Hook Sequencing Out of Order:**
```
⚠️  Sequencing: Found secret-scan → roadmap-check → governance-check (should be governance first)
```
**Fix:** Edit `.git/hooks/pre-commit` to reorder or re-run installer.

## Incident History

**Hook Installer Race (2026-08-23):**
- Problem: `setup-git-hooks.ps1` and `setup-git-hook.mjs` wrote `.git/hooks/pre-commit` independently
- Impact: Last-run installer silently stripped previous checks (governance, secret scanning, retro validation)
- Solution: Single merged shim script that invokes all checks sequentially
- This skill prevents regression of that bug

## Integration

### Pre-Commit Pre-Flight

In CI setup or pre-commit itself:
```bash
/skill hook-validator --strict  # fail if chain is broken
npm test
```

### Post-Hook-Setup Validation

After running hook installers:
```bash
npm run setup:hooks && /skill hook-validator
```

## Reference

See `MEMORY.md` "System Governance & Architecture" for hook design principles.

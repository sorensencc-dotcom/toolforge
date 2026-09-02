# Pre-Flight Test Checker — Usage Guide

## Examples

### Basic Run

```bash
npm run test:preflight
# Output:
# ✓ ESLint Config: .eslintignore includes dist/, build/
# ✓ External Fixtures: cic-research-vault fixture optional, skipping if absent
# ✓ Platform Compliance: Test assertions use public error messages
# GREEN — Ready to run npm test
```

### Verbose Output

```bash
/skill pre-flight-test-checker --verbose
# Includes file-by-file details for each check
```

### Fail on Warnings

```bash
/skill pre-flight-test-checker --failOnWarning
# Exit code 1 for YELLOW results instead of 0
```

## Common Issues & Fixes

**ESLint Config Red Flag:**
```
❌ ESLint Config: Found .eslintignore, but missing entries for: dist/, build/
```
**Fix:** Add to `.eslintignore`:
```
dist/
build/
node_modules/
```

**Fixture Not Found:**
```
⚠️  External Fixtures: cic-research-vault fixture not found (optional, will skip tests)
```
**Fix:** Either (a) mount the fixture workspace, or (b) tests skip gracefully when fixture is absent. Check test code uses `if (fixture) { test(...) }` pattern.

**Platform Assertion Error:**
```
❌ Platform Compliance: Test file test/api.test.js asserts internal error message "db not initialized"
```
**Fix:** Change test assertion to check public message:
```javascript
// Before (internal message — fails cross-platform)
expect(error.message).toBe("db not initialized");

// After (public wrapped message — passes everywhere)
expect(error.message).toMatch(/connection failed|database unavailable/i);
```

## Integration

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:
```bash
npm run test:preflight || exit 1
```

### CI Pipeline

In `.github/workflows/test.yml`:
```yaml
- name: Pre-flight check
  run: npm run test:preflight
  
- name: Run tests
  run: npm test
```

## Reference

Incident history: See `MEMORY.md` — "Pre-Flight Test Unblocking" (2026-08-23).

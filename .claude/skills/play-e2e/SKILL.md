# play-e2e — Playwright E2E Test Runner

Run, debug, and manage Playwright snapshot tests in rewrite-docs.

## Commands

```bash
claude /play-e2e list
# List all available test files

claude /play-e2e run
# Run all tests

claude /play-e2e run button
# Run tests matching pattern (button.spec.ts, etc.)

claude /play-e2e debug button.spec.ts
# Run single test in debug mode (Playwright Inspector)

claude /play-e2e update
# Update snapshots after intentional UI changes

claude /play-e2e report
# Show test report location
```

## When to Use

- **Before component changes**: List tests to understand coverage
- **After edits**: Run tests to catch visual regressions
- **Debugging failures**: Use debug mode to inspect element interactions
- **UI updates approved**: Update snapshots to lock new visuals

## Workflow

### 1. Check what tests exist
```bash
play-e2e list
```

### 2. Run tests before making changes
```bash
play-e2e run
```

### 3. Make component edits
Edit Storybook components in rewrite-docs/

### 4. Run tests again (automated hook or manual)
```bash
play-e2e run
```

### 5. If changes are intentional, update snapshots
```bash
play-e2e update
```

### 6. Debug failures
```bash
play-e2e debug button.spec.ts
# Playwright Inspector opens; click/hover/verify visuals
```

## Test Location

Tests live in: `rewrite-docs/tests/snapshots/`

Config: `rewrite-docs/playwright.config.ts`

## Integration

- **Hook**: E2E snapshot tests auto-run after edits to `.stories.ts` / `.tsx` in rewrite-docs
- **MCP**: Playwright browser automation available during Claude sessions (navigate, screenshot, etc.)
- **CI**: Can integrate with GitHub Actions for automated testing

## See Also

- `npm run test:e2e` — Direct test runner (without skill wrapper)
- `npm run storybook` — View components in isolation

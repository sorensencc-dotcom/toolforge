# HTML Visual Verify

Validation, testing, and auto-fix pipeline for local HTML files — designed to eliminate blind CSS-edit guessing loops.

## What it does

**Three layers of verification:**

1. **Validate** — Static syntax/structure checks (no browser)
   - HTML tag balance (open/close pair counts)
   - Embedded JSON well-formedness (`<script type="application/json">` blocks)
   - JavaScript syntax via `node --check`
   - WCAG AA contrast ratio on CSS custom properties (`:root { --token: #hex; }`)

2. **Test** — Playwright-driven interaction tests
   - Load headless, capture console errors and page exceptions
   - Assert data integrity: rendered card count === manifest count
   - Click filter buttons and refresh; verify DOM state changes
   - Full-page screenshot to scratch directory

3. **Auto-Fix** — Bounded mechanical fixes only
   - Contrast failures: nudge token lightness, re-validate, cap at 2 iterations
   - Syntax errors: report file:line, don't patch blind
   - Color/visual matches: agent still decides, but now reads the actual screenshot instead of guessing hex

## Quick start

```bash
# Validate a file
node src/index.ts path/to/file.html

# With auto-fix (bounded)
node src/index.ts path/to/file.html --fix

# Screenshot only
node src/index.ts path/to/file.html --screenshot

# Full test suite
npm test
```

## Integration

Use this skill **before reporting any visual/CSS change as complete**. Workflow:

1. Edit the HTML file
2. Run this skill: `node src/index.ts <path>`
3. If validation fails, diagnose from the actual output (not blind guessing)
4. If auto-fix enabled, let it attempt mechanical fixes, re-check
5. Read the screenshot via the Read tool and compare against reference
6. Only then report the task done

## See also

- [USAGE.md](docs/USAGE.md) — detailed API reference
- [skill.json](skill.json) — metadata

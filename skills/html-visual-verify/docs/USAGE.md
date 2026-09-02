# HTML Visual Verify — Usage Guide

## API Overview

### `validateHtml(filePath: string): ValidationResult`

Static syntax and structure checks without requiring a browser.

**Checks:**
- **Tag balance** — open/close tag pair count match
- **Embedded JSON** — parse every `<script type="application/json">` block
- **JS syntax** — run `node --check` on every plain `<script>` block
- **WCAG contrast** — compute luminance ratio for known fg/bg color token pairs, flag sub-4.5:1

**Returns:**
```typescript
{
  passed: boolean;
  errors: string[];           // Fatal issues
  warnings: string[];         // Non-fatal (e.g., contrast < 4.5:1)
  checks: {
    tagBalance: { passed: boolean; message: string };
    embeddedJson: { passed: boolean; errors: string[] };
    jsSyntax: { passed: boolean; errors: string[] };
    wcagContrast: { 
      passed: boolean; 
      failures: { token: string; ratio: number; required: number }[]
    };
  }
}
```

### `testInteractive(filePath: string): Promise<TestResult>`

Playwright-based headless browser tests. Loads the file via `file://` protocol.

**Tests:**
- Console error/exception capture
- DOM card count vs manifest count integrity check
- Filter button + refresh button click handlers
- Full-page screenshot capture

**Returns:**
```typescript
{
  passed: boolean;
  errors: string[];
  warnings: string[];
  cardCount: number;
  manifestCount: number;
  checks: {
    consoleErrors: string[];
    cardCountMatch: boolean;
    interactionTests: { name: string; passed: boolean }[];
    screenshotPath?: string;
  }
}
```

### `autoFix(filePath: string, maxIterations = 2): Promise<AutoFixResult>`

Bounded mechanical fixes only. **Does not patch color/visual matching** — those require manual review.

**What it does:**
- Contrast failures: attempts to nudge token lightness, re-checks, caps at N iterations
- Reports failures that still remain after iterations

**Does not:**
- Modify the file itself (dry-run by default)
- Guess at color/visual matching
- Attempt JS syntax fixes

**Returns:**
```typescript
{
  passed: boolean;
  fixed: string[];           // Applied fixes
  still_failing: string[];   // Unresolved issues
  iterations: number;
}
```

## CLI Usage

### Validate only (static checks, no browser)

```bash
node src/index.ts path/to/file.html
```

Output:
```
📋 Validating: path/to/file.html

Validation: ✅ PASS
  Tag balance: OK: 42 open, 42 close, 3 void
  Embedded JSON: ✅ (0 errors)
  JS syntax: ✅ (0 errors)
  WCAG contrast: ✅ (0 failures)
```

### Full test suite (static + Playwright interaction)

```bash
node src/index.ts path/to/file.html --test
```

Adds:
```
🎭 Testing interactive behavior...

Testing: ✅ PASS
  Card count: 21 rendered vs 21 expected ✅
  Console errors: 0
  Interaction tests: 2/2
  Screenshot: /path/to/temp/html-verify-TIMESTAMP.png
```

### Auto-fix mode

```bash
node src/index.ts path/to/file.html --fix
```

Runs validation → attempts fixes up to 2 iterations → reports results.

### Screenshot only

```bash
node src/index.ts path/to/file.html --screenshot
```

Captures the headless render without full test suite.

## Integration workflow

**Before reporting a visual/CSS change as complete:**

1. Edit the HTML file
2. Run validation to catch syntax errors immediately:
   ```bash
   node toolforge/skills/html-visual-verify/src/index.ts path/to/file.html
   ```
3. If validation fails, read the exact error message — don't guess. Fix it.
4. Run full test suite to verify interactivity and capture screenshot:
   ```bash
   node toolforge/skills/html-visual-verify/src/index.ts path/to/file.html
   ```
5. **Read the screenshot file via the Read tool** — actually look at it.
6. Compare the rendered output against your reference/target.
7. If colors/layout don't match, use auto-fix as a diagnostic tool:
   ```bash
   node toolforge/skills/html-visual-verify/src/index.ts path/to/file.html --fix
   ```
8. Only after screenshot matches the target, report complete.

## Exit codes

- `0` — Validation and testing passed
- `1` — Validation or testing failed

## Environment

- Requires Node.js + `@playwright/test` (loaded from repo root `node_modules`)
- Chrome or Chromium available (Playwright's bundled version used)
- Write access to `$TEMP` for temp JS files and screenshots

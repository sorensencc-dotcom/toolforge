# HTML Visual Verify

Validation, testing, and auto-fix pipeline for local HTML — eliminate CSS guessing loops.

## Quick Start

```bash
node src/index.ts path/to/file.html
node src/index.ts path/to/file.html --fix
npm test
```

## What it does

- **Validate** — Tag balance, embedded JSON, JS syntax, WCAG AA contrast
- **Test** — Playwright headless, console errors, interaction tests, screenshots
- **Auto-Fix** — Bounded contrast fixes (lightness nudging only, 2 iterations max)

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For API reference and integration workflow:** See [docs/USAGE.md](docs/USAGE.md).

# HTML Visual Verify Integration Architecture

```
HTML File
    ↓
html-visual-verify (Validator)
    ├─→ Static Validation (Tag balance, JSON checks, CSS contrast checks)
    ├─→ Dynamic Playwright Test (Headless render, Console/exception logs, interaction tests)
    └─→ Bounded Auto-Fix (Lightness adjustment for contrast failures)
        ↓
Screenshot & Test Results Saved
```

## Component Interactions

| Component | Role | Trigger |
|-----------|------|---------|
| html-visual-verify | Pipeline Executor | CLI execution |
| Static Validator | Code syntax and balance audit | Step 1 (Validate) |
| Playwright Test | Interactive headless rendering | Step 2 (Test) |
| Auto-Fix Engine | Mechanical color token updates | Step 3 (Fix) |

## Data Flow

1. **Input**: Path to local HTML file, flags (`--fix`, `--screenshot`)
2. **Processing**: Static checks followed by headless Playwright rendering
3. **Output**: Text validation reports, captured screenshots in scratch folder
4. **Storage**: `scratch/visual-verify/` screenshots and run summaries

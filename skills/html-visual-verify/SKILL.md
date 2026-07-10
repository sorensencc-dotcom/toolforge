---
skill_name: html-visual-verify
version: 1.0.0
name: html-visual-verify
category: validation
description: Validation, testing, and auto-fix pipeline for local HTML files to eliminate CSS guessing loops.
author: Soren (Cast Iron Forge)
tags: ["html","validation","testing","wcag","visual"]
---
# HTML Visual Verify — Visual correctness testing and validation

**Status: ACTIVE**  
**Version: 1.0.0**  
**Category: validation**  
**Owner: Soren**

---

## Purpose

Validation, testing, and auto-fix pipeline for local HTML files — designed to eliminate blind CSS-edit guessing loops.

## Features

1. **Static Validation** — HTML tag balance checks, script block syntax validation, WCAG AA contrast ratio validation.
2. **Dynamic Playwright Testing** — Headless loading, exception and console logging checks, interaction testing.
3. **Bounded Auto-Fix** — Bounded lightness corrections for contrast ratio failures.

## Inputs

```
filePath: string (path to HTML file)
fix: boolean (auto-fix contrast issues)
screenshot: boolean (capture screenshot only)
```

## Outputs

Validation reports, test logs, error details, and page screenshots saved to scratch.

## Exit Codes

- 0: Success
- 1: Warning
- 2: Error

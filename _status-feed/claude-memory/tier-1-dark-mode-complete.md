---
name: tier-1-dark-mode-complete
description: Tier 1 Component Library v2.0 with canonical dark mode tokens — 123/123 tests passing, 52 snapshots, zero drift risk
metadata:
  type: project
---

**Tier 1 Component Library v2.0 — Dark Mode Complete**
2026-06-23

## Deliverable

Canonical dark mode token system + snapshot-tested Tier 1 (9 components):
- **123 tests passing** (100%)
- **52 snapshots** (light + dark baselines)
- **0 regressions** (drift detector baseline set)
- **9/9 components** ready (Button, Panel, Card, Input, Checkbox, Grid, Row, Table, Alert)

## Token Matrix (Final)

**Light mode** (root defaults):
- Surfaces: #ffffff → #f9fafb → #f3f4f6
- Text: #111827 (dark), #6b7280 (muted)
- Accent: #3b82f6 (blue)
- Danger: #dc2626 (red)
- Border: #d1d5db

**Dark mode** `[data-theme="dark"]` overrides:
- Surfaces: #0f0f11 → #161618 → #1d1d20
- Text: #f5f5f7 (light), #a0a0a8 (muted)
- Accent: #4d8dff (lighter blue)
- Danger: #ff6b6b (lighter red)
- Border: #2a2a2e

**Elevation rules** (per-theme):
- Light: subtle drop shadow
- Dark: subtle border + strong shadow (maintains hierarchy)

**Spacing/motion** (immutable):
- Density system orthogonal (compact/cozy/comfortable same across themes)
- Motion tokens: 120ms fast, 160ms medium, cubic-bezier easing
- No hardcoded colors (all 9 CSS files token-driven)

## Test Infrastructure

All 9 test files enhanced with:
1. Theme wrapper helper (`renderWithTheme`)
2. Light mode snapshots (26 total)
3. Dark mode snapshots (26 total)
4. Responsive breakpoint tests
5. Token validation assertions

Validator script: `node scripts/validate-dark-mode.js` (passes 100%).

## Key Files

- `src/components/cic/cic-component-tokens.css` — canonical source
- `src/components/cic/{button,panel,card,input,checkbox,grid,row,table,alert}.css` — aligned
- `src/tests/cic/{Button,Panel,Card,Input,Checkbox,Grid,Row,Table,Alert}.test.tsx` — snapshot tests
- `scripts/validate-dark-mode.js` — automated checker
- `DARK_MODE_V2_IMPLEMENTATION.md` — technical spec
- `DARK_MODE_COMPLETION_REPORT.md` — completion report

## Why This Matters

- **Zero drift risk**: Token file is single source of truth, snapshots catch regressions
- **Stable elevation**: Visual hierarchy preserved (panels > cards) in both themes
- **Orthogonal density**: Spacing independent from color (no accidental drift)
- **Storybook-ready**: All stories render dual-theme automatically
- **visx-ready**: Charts inherit dark mode via tokens
- **Foundation for Phase P**: Panel wiring can use Tier 1 components directly

## Final Cleanup

**Commit c9096ba:** Added `--cic-color-text-inverse` token (#ffffff) for text on colored backgrounds. Eliminates all hardcoded colors from button.css. Validator 100% passing.

## Next

Phase P (Panel Wiring) can start immediately. Agents/Ingestion/Drift/Memory panels use Tier 1 components and inherit dark mode automatically via tokens.

Phase S (Snapshot Matrix Generator): auto-generate chart/gauge baselines when Tier 2/3 ready.
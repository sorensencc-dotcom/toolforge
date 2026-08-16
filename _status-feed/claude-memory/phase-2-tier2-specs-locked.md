---
name: phase-2-tier2-specs-locked
description: "Phase 2 Tier 2 components spec (Panel, Card, Row, Grid) locked; 16 files, 31 tests, 4 parallel commits"
metadata: 
  node_type: memory
  type: project
  originSessionId: c2dc9ccf-4ddb-493a-aa67-ef9434a71d00
---

# Phase 2 Tier 2 Components — Specs Locked

**Date:** 2026-06-22  
**Status:** Spec locked, ready for implementation  
**Files:** 16 (4 TSX + 4 CSS + 4 tests + 4 stories)  
**Tests:** 31 unit + 8 snapshot = 39 total  
**Commits:** 4 atomic (Panel, Card, Row, Grid)

## Components

### Panel v2
- 3 variants: default, elevated, outline
- 4 elevation layers (surface-layer-0 to 3)
- 3 padding densities: compact, cozy, comfortable
- Header + footer slots
- Loading shimmer state
- **8 tests** (variant, elevation, padding, loading, ref, header, footer)

### Card
- Title + subtitle + image + footer slots
- Interactive hover/focus states
- Density-aware padding
- **7 tests** (render, title/subtitle, image, footer, interactive, ref, all-slots)

### Row v2
- Fixed height 36px (density-scaled)
- Selected state (accent border + bg layer)
- Hover state (layer 1 bg)
- Zebra striping (nth-child)
- RowCell helper (expand, icon variants)
- 3 gap densities
- **8 tests** (render, selected, height, ref, gap, cells, zebra)

### Grid
- 12-column base, preset columns: 12/6/4/3/2/1
- GridItem with span: 1/2/3/4/6/12
- Responsive breakpoints: 1200/768/480px
- 3 gap densities
- **8 tests** (render, columns, gap, span, ref, responsiveness, multiple items)

## Token Compliance

All components use:
- `--cic-surface-layer-[0-3]` for elevation
- `--cic-color-border` for borders
- `--cic-color-text` + `--cic-color-text-muted` for text
- `--cic-color-accent` for focus/selected
- `--cic-density-factor` for padding/gap/height scaling
- `--cic-motion-fade` for transitions

## Parallel Dispatch Ready

No inter-component dependencies. Can build all 4 simultaneously:
- Panel v2 (foundation, used by others in demos)
- Card (independent)
- Row v2 (independent)
- Grid (independent)

## Next Gate

- [x] Specs locked in PHASE_2_TIER2_COMPONENTS.md
- [ ] All 28 unit tests passing
- [ ] All 8 snapshot tests captured
- [ ] Indexed in component library docs
- [ ] Ready for Phase 3 (Agents/Ingestion/Drift/Memory/Settings panel wiring)

**Dispatch:** Ready for parallel implementation. 4 commits (Panel → Card → Row → Grid) or simultaneous via 4 subagents.

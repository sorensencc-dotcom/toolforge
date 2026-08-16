---
name: drift-2026-07-14-ui-design-system
description: Wave B-2 UI built without Cast Iron Charlie design system
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ccf05dba-5b2e-42cb-914e-45473bad602b
---

**Incident:** Phase 9 Wave B-2 (React SPA) completed without applying CIC design system.

**What happened:** UI implemented with generic purple gradient header (#667eea), basic card layout, standard button styling. No Cast Iron Charlie conformance.

**Why:** Speed bias in Wave B execution. Focused on functionality (routes, API calls, form logic) over visual conformance. Skipped pre-code design check.

**Design System Violated:** [[cic-design-system-preference]] requires Cast Iron Charlie for all CIC artifacts.

**Cast Iron Charlie Requirements:**
- **Palette:** Ember (#c85a37), Rust (#8b4513), Brass (#b8860b) — warm, grave tone
- **Typography:** Playfair (headlines), Baskerville (body), Barlow (labels/UI)
- **Texture:** Film grain overlay (subtle, 20-30% opacity)
- **Tone:** Institutional, restrained; no emoji, no casual language in UI copy
- **Layout:** Semantic grid, high contrast, accessible focus states

**Scope:** C:\dev\src\ui\styles\App.css (700+ lines), component class names unchanged.

**How to Apply:** Design check BEFORE code commit on all artifact-bearing waves. Template: vite.config → index.html → App.css → preview → verify contrast/typography/palette matches system.

**Related:** [[cic-design-system-preference]], [[drift-incident-2026-07-13-dashboard]] (similar violation, fixed in v1.5.1)

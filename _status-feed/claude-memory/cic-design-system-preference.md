---
name: cic-design-system-preference
description: "CIC artifacts use Cast Iron Charlie design system — grave tone, Playfair/Baskerville/Barlow, ember/rust/brass, zero border-radius, film grain"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0547e723-ba1b-434f-bf82-37e8f88c2262
---

# CIC Design System Standard

All CIC artifacts (training guides, policy docs, operational runbooks, governance materials) use [[cast-iron-charlie-design-system]] going forward.

**Why:** Grave, literary, archival tone matches CIC governance/operational documentation. Creates visual consistency across deliverables. Film grain + custom palette convey authority and seriousness.

**How to apply:** When creating any CIC artifact in HTML format:
1. Load Google Fonts: Playfair Display, Libre Baskerville, Barlow Condensed
2. Define CSS custom properties (--black, --forge, --iron, --ember, --brass, --ash, --bone)
3. Apply film grain SVG fractalNoise overlay on body::before
4. Use Playfair for all headings
5. Use Barlow Condensed for labels/nav/CTAs (ALL CAPS, letter-spacing 0.2–0.4em)
6. Zero border-radius everywhere
7. Gradient horizontal rules (not plain <hr>)
8. Em-dash bullets, arrow CTAs, no emoji

See cast-iron-charlie-design-system.md for full spec + checklist.

**Applied to:**
- phase-27-wave-f-operator-training (2026-07-07)
